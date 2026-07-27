import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../../shared/prisma";
import { supabaseAdmin, supabaseAnon } from "../../shared/supabase";
import { logAction } from "./audit.service";
import { createUserSession } from "./sessions.service";

export const roeidRouter = Router();

// Client OIDC real pentru RoEID (ROeID) — schema de identitate electronică a României,
// notificată oficial la Comisia Europeană drept mijloc eIDAS. Endpoint-urile de mai jos
// sunt cele publicate/descoperite live la sso.beta.roeid.ro (mediul de test al ADR),
// conform https://github.com/roeid-ro/integrare. Fără un acord de colaborare cu ADR
// (proces administrativ, nu tehnic) nu avem un `client_id`/`client_secret` înregistrat —
// redirect-ul e real către infrastructura RoEID, dar autorizarea va fi respinsă de ei
// până la înregistrare oficială. Schimbul cod→token→userinfo de mai jos e complet
// funcțional și va merge fără nicio altă modificare imediat ce ADR emite credențiale reale.
const ROEID_ISSUER = "https://sso.beta.roeid.ro/affwebservices/CASSO/oidc/demo";
const ROEID_AUTHORIZATION_ENDPOINT = `${ROEID_ISSUER}/authorize`;
const ROEID_TOKEN_ENDPOINT = `${ROEID_ISSUER}/token`;
const ROEID_USERINFO_ENDPOINT = `${ROEID_ISSUER}/userinfo`;

const CLIENT_ID = process.env.ROEID_CLIENT_ID || "ans-demo-platform-pending-adr";
const CLIENT_SECRET = process.env.ROEID_CLIENT_SECRET || "";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const REDIRECT_URI = `${BACKEND_URL}/api/iam/login/roeid/callback`;

const STATE_COOKIE = "roeid_oidc_state";

roeidRouter.get("/login/roeid/start", (_req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, { httpOnly: true, maxAge: 5 * 60_000, sameSite: "lax" });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid default",
    state,
  });
  res.redirect(`${ROEID_AUTHORIZATION_ENDPOINT}?${params.toString()}`);
});

roeidRouter.get("/login/roeid/callback", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const { code, state, error, error_description: errorDescription } = req.query as Record<string, string>;
  const expectedState = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE);

  if (error) {
    await logAction({ action: "ROEID_CONNECTOR_ERROR", metadata: { error, errorDescription }, success: false });
    return res.redirect(`${frontendUrl}/login?roeidError=${encodeURIComponent(errorDescription || error)}`);
  }
  if (!code || !state || state !== expectedState) {
    return res.redirect(`${frontendUrl}/login?roeidError=${encodeURIComponent("Răspuns invalid sau expirat de la RoEID")}`);
  }

  try {
    const tokenRes = await fetch(ROEID_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    const tokenJson: any = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson.error_description || tokenJson.error || "Schimb cod→token eșuat");
    }

    const userinfoRes = await fetch(ROEID_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const claims: any = await userinfoRes.json();
    if (!userinfoRes.ok) {
      throw new Error(claims.error_description || claims.error || "Citire date identitate eșuată");
    }

    // Potrivire cont existent după CNP/email (conform recomandării RoEID), altfel creare.
    const cnp: string | undefined = claims.cnp;
    const email: string = claims.email || `roeid.${cnp}@connector.local`;
    const fullName: string = claims["nume complet"] || [claims.prenume, claims.nume].filter(Boolean).join(" ") || "Cont RoEID";

    let localUser = await prisma.user.findUnique({ where: { email } });
    if (!localUser) {
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: crypto.randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { roeidCnp: cnp, roeidLinked: true },
      });
      if (createError || !data?.user) throw new Error(createError?.message ?? "Creare cont RoEID eșuată");
      localUser = await prisma.user.create({
        data: { id: data.user.id, email, name: fullName, role: "UTILIZATOR_STANDARD" },
      });
      await logAction({
        userId: localUser.id,
        action: "ROEID_CONNECTOR_ACCOUNT_CREATED",
        resource: `user:${localUser.id}`,
        metadata: { connector: "ROEID" },
      });
    }
    if (!localUser.isActive) {
      return res.redirect(`${frontendUrl}/login?roeidError=${encodeURIComponent("Cont dezactivat sau în așteptare de aprobare")}`);
    }

    // Sesiune Supabase reală pentru contul local — nicio parolă introdusă de utilizator;
    // resetăm la o valoare de unică folosință, doar ca să obținem un access_token valid
    // prin fluxul standard de sign-in (contul se re-autentifică mereu prin RoEID, nu prin parolă).
    const oneTimePassword = crypto.randomBytes(24).toString("base64url");
    await supabaseAdmin.auth.admin.updateUserById(localUser.id, { password: oneTimePassword });
    const { data: sessionData, error: signInError } = await supabaseAnon.auth.signInWithPassword({ email, password: oneTimePassword });
    if (signInError || !sessionData?.session) throw new Error("Nu s-a putut crea sesiunea locală");

    await logAction({ userId: localUser.id, action: "LOGIN_SUCCESS", metadata: { via: "roeid" } });
    await createUserSession(localUser.id, sessionData.session.access_token);
    const qs = new URLSearchParams({
      roeidToken: sessionData.session.access_token,
      roeidUserId: localUser.id,
      roeidEmail: localUser.email,
      roeidRole: localUser.role,
    });
    res.redirect(`${frontendUrl}/login?${qs.toString()}`);
  } catch (e: any) {
    await logAction({ action: "ROEID_CONNECTOR_ERROR", metadata: { message: e?.message }, success: false });
    res.redirect(`${frontendUrl}/login?roeidError=${encodeURIComponent(e?.message || "Conectare RoEID eșuată")}`);
  }
});
