import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";
import { generateTwoFactorSecret, verifyTwoFactorToken } from "./totp";
import { signToken } from "./jwt";
import { requireAuth, requireRole, AuthedRequest } from "./rbac.middleware";
import { logAction, queryAuditLog } from "./audit.service";
import { encryptSecret, decryptSecret } from "./secrets.service";
import { DEFAULT_AUTH_POLICY } from "./types";

export const iamRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().optional(),
});

// 1) Identity service — creare cont (CRUD conturi + grupuri)
iamRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password, name } = parsed.data;
  const strength = validatePasswordStrength(password);
  if (!strength.valid) return res.status(400).json({ error: strength.reason });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Există deja un cont cu acest email" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "UTILIZATOR_STANDARD" },
  });

  await logAction({ userId: user.id, action: "USER_REGISTERED", resource: `user:${user.id}` });
  res.status(201).json({ id: user.id, email: user.email, role: user.role });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorToken: z.string().optional(),
});

// 2) Fluxuri de autentificare configurabile: parolă + 2FA + politici de sesiune/blocare
iamRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, twoFactorToken } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await logAction({ action: "LOGIN_FAILED", metadata: { email }, success: false });
    return res.status(401).json({ error: "Credențiale invalide" });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(423).json({ error: "Cont blocat temporar din cauza tentativelor eșuate" });
  }

  const validPassword = await verifyPassword(password, user.passwordHash);
  if (!validPassword) {
    const failedCount = user.failedLoginCount + 1;
    const shouldLock = failedCount >= DEFAULT_AUTH_POLICY.maxFailedAttempts;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : failedCount,
        lockedUntil: shouldLock
          ? new Date(Date.now() + DEFAULT_AUTH_POLICY.lockoutMinutes * 60_000)
          : undefined,
      },
    });
    await logAction({ userId: user.id, action: "LOGIN_FAILED", success: false });
    return res.status(401).json({ error: "Credențiale invalide" });
  }

  if (user.twoFactorEnabled) {
    if (!twoFactorToken) {
      return res.status(206).json({ requiresTwoFactor: true });
    }
    if (!user.twoFactorSecret || !verifyTwoFactorToken(user.twoFactorSecret, twoFactorToken)) {
      await logAction({ userId: user.id, action: "LOGIN_2FA_FAILED", success: false });
      return res.status(401).json({ error: "Cod 2FA invalid" });
    }
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  const token = signToken({ sub: user.id, email: user.email, role: user.role });
  await logAction({ userId: user.id, action: "LOGIN_SUCCESS" });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

// 3) Activare 2FA (TOTP) pentru contul autentificat curent
iamRouter.post("/2fa/setup", requireAuth, async (req: AuthedRequest, res) => {
  const { secret, otpauthUrl } = generateTwoFactorSecret(req.user!.email);
  await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactorSecret: secret } });
  res.json({ otpauthUrl }); // clientul generează QR code din acest URL
});

iamRouter.post("/2fa/verify", requireAuth, async (req: AuthedRequest, res) => {
  const { token } = req.body as { token: string };
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user?.twoFactorSecret || !verifyTwoFactorToken(user.twoFactorSecret, token)) {
    return res.status(400).json({ error: "Cod invalid" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await logAction({ userId: user.id, action: "2FA_ENABLED" });
  res.json({ enabled: true });
});

// 4) Administrare utilizatori — doar Super Admin / Admin Instituție (RBAC)
iamRouter.get(
  "/users",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, isActive: true, twoFactorEnabled: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(users);
  }
);

// Blocare/deblocare instantanee cont (cerință explicită din Scenariul 5, reutilizată aici)
iamRouter.patch(
  "/users/:id/active",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE"),
  async (req: AuthedRequest, res) => {
    const { isActive } = req.body as { isActive: boolean };
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { isActive } });
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
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { role } });
    await logAction({ userId: req.user!.id, action: "ROLE_CHANGED", resource: `user:${updated.id}`, metadata: { role } });
    res.json({ id: updated.id, role: updated.role });
  }
);

// 5) Jurnal de audit — filtrare/căutare avansată
iamRouter.get(
  "/audit",
  requireAuth,
  requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"),
  async (req, res) => {
    const { userId, action, from, to } = req.query as Record<string, string>;
    const logs = await queryAuditLog({
      userId,
      action,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
    res.json(logs);
  }
);

// 6) Secret Manager — stocare/recuperare securizată (chei API, certificate)
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
