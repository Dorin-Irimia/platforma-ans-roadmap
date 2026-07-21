import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../../shared/prisma";
import { supabaseAdmin, supabaseAnon, supabaseAsUser } from "../../shared/supabase";
import { requireAuth, requireRole, AuthedRequest } from "./rbac.middleware";
import { logAction, queryAuditLog } from "./audit.service";
import { encryptSecret, decryptSecret } from "./secrets.service";
import { getAuthPolicy, validatePassword } from "./policy";

// Limitare de rată pe autentificare — cerință de monitorizare securitate (Scenariul 5,
// pct. 9: „simulare/vizualizare evenimente de securitate ... rate limiting"), separată de
// blocarea contului după N eșecuri (AuthPolicySettings), care e per-cont, nu per-IP.
const loginRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res) => {
    await logAction({
      action: "RATE_LIMIT_TRIGGERED",
      resource: "auth:login",
      metadata: { ip: req.ip, email: (req.body as { email?: string })?.email },
      success: false,
    });
    res.status(429).json({ error: "Prea multe încercări — reîncearcă peste un minut" });
  },
});

export const iamRouter = Router();

const ROLE_VALUES = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUTIE",
  "MODERATOR",
  "EVALUATOR",
  "AUTOR",
  "CO_AUTOR",
  "UTILIZATOR_STANDARD",
] as const;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

// 1) Identity service — creare cont (auto-înregistrare Portal cetățeni). Credențialele
// sunt gestionate integral de Supabase Auth; păstrăm doar rolul/starea contului local.
// Dublă poartă înainte de primul login: (a) confirmare email — Supabase trimite automat
// link de confirmare la signUp() și refuză login-ul până e accesat; (b) aprobare de
// administrator — contul pornește inactiv local, un admin trebuie să-l deblocheze explicit.
iamRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, name } = parsed.data;

  const policy = await getAuthPolicy();
  const strength = validatePassword(password, policy);
  if (!strength.valid) return res.status(400).json({ error: strength.reason });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Există deja un cont cu acest email" });

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });
  if (error || !data?.user) {
    return res.status(400).json({ error: error?.message ?? "Înregistrare eșuată" });
  }

  // Bootstrap: primul cont creat în sistem devine automat Super Admin activ (nu poate
  // aștepta aprobare — nu ar exista încă niciun admin care să-l aprobe). Toți ceilalți
  // pornesc dezactivați, până la aprobare manuală în panoul de administrare.
  const userCount = await prisma.user.count();
  const isBootstrap = userCount === 0;
  const role = isBootstrap ? "SUPER_ADMIN" : "UTILIZATOR_STANDARD";

  const user = await prisma.user.create({
    data: { id: data.user.id, email, name, role, isActive: isBootstrap, pendingApprovalSince: isBootstrap ? null : new Date() },
  });
  if (!isBootstrap) {
    // Cont încă neaprobat — blocăm și la nivel Supabase, ca la orice cont dezactivat.
    await supabaseAdmin.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  }

  await logAction({ userId: user.id, action: "USER_REGISTERED", resource: `user:${user.id}`, metadata: { bootstrapAdmin: isBootstrap } });
  res.status(201).json({
    id: user.id,
    email: user.email,
    role: user.role,
    pendingApproval: !isBootstrap,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().optional(),
  emailOtpCode: z.string().optional(),
});

function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Verifică parola contra Supabase și, dacă e cazul, cere/validează al doilea factor —
// TOTP (Supabase MFA, aal2) sau Email OTP (canal local paralel, vezi EmailOtpFactor/
// EmailOtpChallenge — Supabase MFA nu are un tip de factor "email"). Comun între /login
// și fluxul eIDAS mock, care ambele se termină cu o sesiune Supabase reală.
async function completeLogin(
  email: string,
  password: string,
  totpCode: string | undefined,
  emailOtpCode: string | undefined,
  res: any
) {
  const policy = await getAuthPolicy();
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser?.lockedUntil && existingUser.lockedUntil > new Date()) {
    return res.status(423).json({ error: "Cont blocat temporar din cauza tentativelor eșuate" });
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data?.user) {
    // Email neconfirmat / cont blocat (inclusiv "în așteptare de aprobare" — vezi /register)
    // nu sunt tentative eșuate de parolă — nu trebuie să contribuie la contorul de lockout.
    if (error?.code === "email_not_confirmed") {
      await logAction({ userId: existingUser?.id, action: "LOGIN_BLOCKED_EMAIL_UNCONFIRMED", success: false });
      return res.status(403).json({ error: "Confirmă adresa de email (verifică mesajul primit) înainte de a te autentifica" });
    }
    if (error?.code === "user_banned") {
      await logAction({ userId: existingUser?.id, action: "LOGIN_BLOCKED_ACCOUNT_INACTIVE", success: false });
      return res.status(423).json({ error: "Cont dezactivat sau în așteptare de aprobare din partea unui administrator" });
    }
    if (existingUser) {
      const failedCount = existingUser.failedLoginCount + 1;
      const shouldLock = failedCount >= policy.maxFailedAttempts;
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          failedLoginCount: shouldLock ? 0 : failedCount,
          lockedUntil: shouldLock ? new Date(Date.now() + policy.lockoutMinutes * 60_000) : undefined,
        },
      });
    }
    await logAction({ action: "LOGIN_FAILED", metadata: { email }, success: false });
    return res.status(401).json({ error: "Credențiale invalide" });
  }

  let finalAccessToken = data.session.access_token;
  const userClient = supabaseAsUser(data.session.access_token);
  // Fără JWT explicit, getAuthenticatorAssuranceLevel() citește sesiunea internă a
  // clientului (mereu goală aici — clientul e efemer, per-cerere) — trebuie dat tokenul direct.
  const { data: aal } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel(data.session.access_token);
  const needsTotp = !!(aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2");
  const emailOtpFactor = await prisma.emailOtpFactor.findUnique({ where: { userId: data.user.id } });
  const needsEmailOtp = !!emailOtpFactor?.enabled;

  if (needsTotp || needsEmailOtp) {
    if (!totpCode && !emailOtpCode) {
      const methods = [needsTotp ? "totp" : null, needsEmailOtp ? "email" : null].filter(Boolean);
      return res.status(206).json({ requiresTwoFactor: true, methods });
    }

    if (totpCode) {
      const { data: factorsData } = await userClient.auth.mfa.listFactors();
      const totpFactor = factorsData?.totp?.find((f) => f.status === "verified");
      if (!totpFactor) {
        return res.status(401).json({ error: "Niciun factor 2FA verificat pe acest cont" });
      }
      const { data: verifyData, error: verifyError } = await userClient.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: totpCode,
      });
      if (verifyError || !verifyData?.access_token) {
        await logAction({ userId: existingUser?.id, action: "LOGIN_2FA_FAILED", success: false });
        return res.status(401).json({ error: "Cod 2FA invalid" });
      }
      finalAccessToken = verifyData.access_token;
    } else if (emailOtpCode) {
      const challenge = await prisma.emailOtpChallenge.findFirst({
        where: { userId: data.user.id, consumedAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (!challenge || challenge.expiresAt < new Date() || challenge.codeHash !== hashOtpCode(emailOtpCode)) {
        await logAction({ userId: existingUser?.id, action: "LOGIN_2FA_FAILED", success: false });
        return res.status(401).json({ error: "Cod invalid sau expirat" });
      }
      await prisma.emailOtpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    }
  }

  const localUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!localUser) {
    await logAction({ action: "LOGIN_FAILED", metadata: { email, reason: "no_local_row" }, success: false });
    return res.status(401).json({ error: "Cont incomplet — contactează un administrator" });
  }
  if (!localUser.isActive) {
    return res.status(423).json({ error: "Cont dezactivat" });
  }

  if (localUser.failedLoginCount > 0 || localUser.lockedUntil) {
    await prisma.user.update({ where: { id: localUser.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  await logAction({ userId: localUser.id, action: "LOGIN_SUCCESS" });
  return res.json({
    token: finalAccessToken,
    user: { id: localUser.id, email: localUser.email, role: localUser.role },
  });
}

// 2) Autentificare — parola e verificată de Supabase Auth; dacă e activat 2FA (Supabase MFA),
// necesită și un cod TOTP valid înainte de a elibera sesiunea finală (aal2).
iamRouter.post("/login", loginRateLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, totpCode, emailOtpCode } = parsed.data;
  await completeLogin(email, password, totpCode, emailOtpCode, res);
});

// Conectorul real eIDAS/RoEID (redirect OIDC către sso.beta.roeid.ro) e implementat separat
// în ./roeid.ts (roeidRouter) — RoEID este schema românească notificată la Comisia Europeană
// ca mijloc eIDAS, deci un singur conector real deserveşte ambele etichete din UI.

// 3) 2FA (TOTP) prin Supabase MFA — enroll/verify/disable/listare, pe sesiunea proprie a
// utilizatorului autentificat (nu se poate face prin service_role).
iamRouter.post("/2fa/enroll", requireAuth, async (req: AuthedRequest, res) => {
  const token = req.headers.authorization!.slice(7);
  const { data, error } = await supabaseAsUser(token).auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return res.status(400).json({ error: error?.message ?? "Activare 2FA eșuată" });
  res.json({ factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret });
});

const verify2faSchema = z.object({ factorId: z.string(), code: z.string() });

iamRouter.post("/2fa/verify", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = verify2faSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const token = req.headers.authorization!.slice(7);
  const { error } = await supabaseAsUser(token).auth.mfa.challengeAndVerify(parsed.data);
  if (error) return res.status(400).json({ error: "Cod invalid" });
  await logAction({ userId: req.user!.id, action: "2FA_ENABLED" });
  res.json({ enabled: true });
});

const disable2faSchema = z.object({ factorId: z.string() });

iamRouter.post("/2fa/disable", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = disable2faSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const token = req.headers.authorization!.slice(7);
  const { error } = await supabaseAsUser(token).auth.mfa.unenroll(parsed.data);
  if (error) return res.status(400).json({ error: error.message });
  await logAction({ userId: req.user!.id, action: "2FA_DISABLED" });
  res.json({ enabled: false });
});

iamRouter.get("/2fa/factors", requireAuth, async (req: AuthedRequest, res) => {
  const token = req.headers.authorization!.slice(7);
  const { data, error } = await supabaseAsUser(token).auth.mfa.listFactors();
  if (error || !data) return res.status(400).json({ error: error?.message ?? "Eroare la citirea factorilor 2FA" });
  res.json({ factors: data.totp });
});

// 4) 2FA (Email OTP) — al doilea canal, complet local (Supabase MFA nu are un factor de
// tip email). Cod generat/stocat(hash)/verificat real server-side; doar trimiterea e simulată.
iamRouter.get("/2fa-email/status", requireAuth, async (req: AuthedRequest, res) => {
  const factor = await prisma.emailOtpFactor.findUnique({ where: { userId: req.user!.id } });
  res.json({ enabled: !!factor?.enabled });
});

iamRouter.post("/2fa-email/enroll", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.emailOtpFactor.upsert({
    where: { userId: req.user!.id },
    update: { enabled: true },
    create: { userId: req.user!.id, enabled: true },
  });
  await logAction({ userId: req.user!.id, action: "2FA_EMAIL_ENABLED" });
  res.json({ enabled: true });
});

iamRouter.post("/2fa-email/disable", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.emailOtpFactor.upsert({
    where: { userId: req.user!.id },
    update: { enabled: false },
    create: { userId: req.user!.id, enabled: false },
  });
  await logAction({ userId: req.user!.id, action: "2FA_EMAIL_DISABLED" });
  res.json({ enabled: false });
});

const requestEmailOtpSchema = z.object({ email: z.string().email(), password: z.string() });

// Apelată din ecranul de login (deci fără sesiune încă) — re-validează parola, exact ca
// resubmisia login-ului cu totpCode, ca să nu poată cineva provoca trimiterea unui cod
// fără să cunoască deja parola contului.
iamRouter.post("/2fa-email/request", loginRateLimiter, async (req, res) => {
  const parsed = requestEmailOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password } = parsed.data;

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return res.status(401).json({ error: "Credențiale invalide" });

  const factor = await prisma.emailOtpFactor.findUnique({ where: { userId: data.user.id } });
  if (!factor?.enabled) return res.status(400).json({ error: "Email OTP nu este activat pentru acest cont" });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await prisma.emailOtpChallenge.create({
    data: { userId: data.user.id, codeHash: hashOtpCode(code), expiresAt: new Date(Date.now() + 10 * 60_000) },
  });

  // Trimitere simulată (fără provider real de email) — pattern identic cu RESPONSE_SENT /
  // WORKFLOW_ACTION_SEND_EMAIL: acțiunea reală (generare+stocare cod) e făcută, „trimiterea" e doar logată.
  await logAction({ userId: data.user.id, action: "2FA_EMAIL_SENT", metadata: { recipientEmail: email } });

  // Codul e întors direct în răspuns (nu doar logat) — la acest pas utilizatorul nu e încă
  // autentificat și nu poate verifica Jurnalul de Audit ca la alte notificări simulate.
  res.json({ sent: true, devCode: code });
});

// Sesiune curentă — folosit de frontend la reîncărcarea paginii pentru a re-hidrata contul din token.
iamRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) return res.status(401).json({ error: "Cont indisponibil" });
  res.json(user);
});

// 4) Administrare utilizatori — doar Super Admin / Admin Instituție (RBAC)
iamRouter.get(
  "/users",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (_req, res) => {
    const policy = await getAuthPolicy();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true, pendingApprovalSince: true },
      orderBy: { createdAt: "desc" },
    });
    const expiryMs = policy.pendingApprovalExpiryDays * 86_400_000;
    res.json(
      users.map((u) => ({
        ...u,
        // Regulă automată (evaluată leneș, la fiecare listare): un cont încă neaprobat
        // după atâtea zile e semnalat, cu opțiunea de respingere în bloc mai jos.
        pendingTooLong: !!u.pendingApprovalSince && Date.now() - u.pendingApprovalSince.getTime() > expiryMs,
      }))
    );
  }
);

// Respingere în bloc a conturilor rămase în așteptare de aprobare peste pragul configurat
// (AuthPolicySettings.pendingApprovalExpiryDays) — șterge contul (nu a fost niciodată activ).
iamRouter.post(
  "/users/reject-expired-pending",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const policy = await getAuthPolicy();
    const expiryMs = policy.pendingApprovalExpiryDays * 86_400_000;
    const candidates = await prisma.user.findMany({
      where: { isActive: false, pendingApprovalSince: { not: null } },
      select: { id: true, email: true, pendingApprovalSince: true },
    });
    const expired = candidates.filter((u) => u.pendingApprovalSince && Date.now() - u.pendingApprovalSince.getTime() > expiryMs);

    for (const u of expired) {
      await supabaseAdmin.auth.admin.deleteUser(u.id).catch(() => {});
      await prisma.user.delete({ where: { id: u.id } });
      await logAction({ userId: req.user!.id, action: "PENDING_ACCOUNT_AUTO_REJECTED", resource: `user:${u.id}`, metadata: { email: u.email } });
    }
    res.json({ rejected: expired.length });
  }
);

// Invitație pe email pentru un angajat nou — singurul mod prin care se creează
// conturi de personal (spre deosebire de auto-înregistrarea publică de mai sus).
const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(ROLE_VALUES),
});

iamRouter.post(
  "/users/invite",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const { email, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Există deja un cont cu acest email" });

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: `${process.env.FRONTEND_URL}/accept-invite`,
    });
    if (error || !data?.user) {
      return res.status(400).json({ error: error?.message ?? "Invitație eșuată" });
    }

    const user = await prisma.user.create({
      data: { id: data.user.id, email, name, role, isActive: true },
    });
    await logAction({
      userId: req.user!.id,
      action: "EMPLOYEE_INVITED",
      resource: `user:${user.id}`,
      metadata: { invitedEmail: email, role },
    });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
  }
);

// Blocare/deblocare instantanee cont (cerință explicită din Scenariul 5, reutilizată aici).
// Blocăm și la nivel Supabase (ban_duration), nu doar flag-ul local, altfel un cont
// "dezactivat" ar putea încă obține o sesiune validă de la Supabase.
iamRouter.patch(
  "/users/:id/active",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const { isActive } = req.body as { isActive: boolean };
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive, pendingApprovalSince: isActive ? null : undefined },
    });
    await supabaseAdmin.auth.admin.updateUserById(updated.id, {
      ban_duration: isActive ? "none" : "876000h",
    });
    await logAction({
      userId: req.user!.id,
      action: isActive ? "USER_UNLOCKED" : "USER_LOCKED",
      resource: `user:${updated.id}`,
    });
    res.json({ id: updated.id, isActive: updated.isActive });
  }
);

// Schimbare rol (RBAC granular pe roluri predefinite/personalizate)
iamRouter.patch(
  "/users/:id/role",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const { role } = req.body;
    const before = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await logAction({
      userId: req.user!.id,
      action: "ROLE_CHANGED",
      resource: `user:${updated.id}`,
      metadata: { oldRole: before?.role, newRole: updated.role },
    });
    res.json({ id: updated.id, role: updated.role });
  }
);

// Ștergere definitivă cont (identitate unificată — complementară suspendării de mai sus).
iamRouter.delete(
  "/users/:id",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    await supabaseAdmin.auth.admin.deleteUser(req.params.id);
    await prisma.user.delete({ where: { id: req.params.id } });
    await logAction({ userId: req.user!.id, action: "USER_DELETED", resource: `user:${req.params.id}` });
    res.status(204).end();
  }
);

// 5) Politică de autentificare configurabilă (durată sesiune, complexitate parolă, lockout).
// GET e public — necesar la înregistrare/acceptare invitație pentru validarea parolei pe client.
iamRouter.get("/auth-policy", async (_req, res) => {
  const policy = await getAuthPolicy();
  res.json(policy);
});

const policySchema = z.object({
  sessionMinutes: z.number().int().min(1),
  minPasswordLength: z.number().int().min(4),
  requireUppercase: z.boolean(),
  requireNumber: z.boolean(),
  maxFailedAttempts: z.number().int().min(1),
  lockoutMinutes: z.number().int().min(1),
  pendingApprovalExpiryDays: z.number().int().min(1),
});

iamRouter.patch(
  "/auth-policy",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const parsed = policySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const before = await prisma.authPolicySettings.findUnique({ where: { id: "singleton" } });
    const updated = await prisma.authPolicySettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    const { id: _beforeId, updatedAt: _beforeUpdatedAt, ...oldValues } = before || ({} as typeof updated);
    await logAction({ userId: req.user!.id, action: "AUTH_POLICY_UPDATED", metadata: { old: oldValues, new: parsed.data } });
    res.json(updated);
  }
);

// 5b) Configurare AI comună (Chatbot + LMS) — selectarea modelului implicit
// (cerință explicită Scenariul 5, pct. 8). Cheia API rămâne în Secret Manager.
iamRouter.get("/ai-settings", requireAuth, requireRole("SUPER_ADMIN"), async (_req, res) => {
  const settings = await prisma.aiSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  res.json(settings);
});

const aiSettingsSchema = z.object({ defaultModel: z.string().min(1) });

iamRouter.patch(
  "/ai-settings",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const parsed = aiSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await prisma.aiSettings.upsert({
      where: { id: "singleton" },
      update: parsed.data,
      create: { id: "singleton", ...parsed.data },
    });
    await logAction({ userId: req.user!.id, action: "AI_SETTINGS_UPDATED", metadata: parsed.data });
    res.json(updated);
  }
);

// 6) Jurnal de audit — filtrare/căutare avansată + paginare
iamRouter.get(
  "/audit",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"),
  async (req, res) => {
    const { userId, action, resource, success, from, to, limit, offset } = req.query as Record<string, string>;
    const logs = await queryAuditLog({
      userId,
      action,
      resource,
      success: success === "true" ? true : success === "false" ? false : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    res.json(logs);
  }
);

// 7) Secret Manager — stocare/recuperare securizată (chei API, certificate) + export
// manifest Kubernetes (punctul de integrare infra cerut de caiet, fără cluster real).
iamRouter.get(
  "/secrets",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (_req, res) => {
    const secrets = await prisma.secret.findMany({
      select: { key: true, updatedAt: true },
      orderBy: { key: "asc" },
    });
    res.json(secrets);
  }
);

iamRouter.post(
  "/secrets",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const { key, value } = req.body as { key: string; value: string };
    const encryptedValue = encryptSecret(value);
    const secret = await prisma.secret.upsert({
      where: { key },
      update: { encryptedValue },
      create: { key, encryptedValue },
    });
    await logAction({ userId: req.user!.id, action: "SECRET_SET", resource: `secret:${key}` });
    res.json({ key: secret.key, updatedAt: secret.updatedAt });
  }
);

iamRouter.get(
  "/secrets/:key",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const secret = await prisma.secret.findUnique({ where: { key: req.params.key } });
    if (!secret) return res.status(404).json({ error: "Secret inexistent" });
    await logAction({ userId: req.user!.id, action: "SECRET_READ", resource: `secret:${secret.key}` });
    res.json({ key: secret.key, value: decryptSecret(secret.encryptedValue) });
  }
);

iamRouter.get(
  "/secrets/:key/k8s-manifest",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  async (req: AuthedRequest, res) => {
    const secret = await prisma.secret.findUnique({ where: { key: req.params.key } });
    if (!secret) return res.status(404).json({ error: "Secret inexistent" });
    const value = decryptSecret(secret.encryptedValue);
    const manifestName = secret.key.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const yaml = [
      "apiVersion: v1",
      "kind: Secret",
      "metadata:",
      `  name: ${manifestName}`,
      "type: Opaque",
      "data:",
      `  value: ${Buffer.from(value, "utf8").toString("base64")}`,
      "",
    ].join("\n");
    await logAction({ userId: req.user!.id, action: "SECRET_EXPORTED_K8S", resource: `secret:${secret.key}` });
    res.setHeader("Content-Type", "application/yaml");
    res.setHeader("Content-Disposition", `attachment; filename="${manifestName}-secret.yaml"`);
    res.send(yaml);
  }
);
