// Sesiuni active per-dispozitiv + revocare individuală — corelate cu tokenul Supabase
// prin claim-ul `session_id` din JWT, decodat direct (fără verificare de semnătură: aceea
// se face oricum la fiecare cerere prin supabaseAdmin.auth.getUser(), acesta e doar id-ul
// de corelare cu rândul UserSession).
import { prisma } from "../../shared/prisma";
import { requestContext } from "../../shared/requestContext";

function decodeJwtPayload(token: string): any {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function extractSessionId(accessToken: string): string | null {
  return decodeJwtPayload(accessToken)?.session_id ?? null;
}

// Apelat la finalul oricărui flux de autentificare reușit (parolă + 2FA, RoEID) — creează
// (sau reactivează, dacă a fost cumva reemis același session_id) rândul de sesiune activă.
export async function createUserSession(userId: string, accessToken: string) {
  const supabaseSessionId = extractSessionId(accessToken);
  if (!supabaseSessionId) return null;
  const ctx = requestContext.getStore();
  return prisma.userSession.upsert({
    where: { supabaseSessionId },
    create: { userId, supabaseSessionId, ipAddress: ctx?.ip, userAgent: ctx?.userAgent },
    update: { revokedAt: null, lastSeenAt: new Date() },
  });
}

const TOUCH_THROTTLE_MS = 5 * 60_000;

// Verifică revocarea la fiecare cerere autentificată + actualizează lastSeenAt (trotat,
// ca să nu scriem în DB la fiecare request) — apelat din rbac.middleware.ts. Sesiunile
// autentificate înainte de introducerea acestei funcționalități (fără rând UserSession,
// tokenul emis anterior nu are cum să capete unul retroactiv) nu sunt respinse — doar
// nu apar în lista "sesiuni active" până la următorul login.
export async function checkAndTouchSession(accessToken: string): Promise<boolean> {
  const supabaseSessionId = extractSessionId(accessToken);
  if (!supabaseSessionId) return true;
  const session = await prisma.userSession.findUnique({ where: { supabaseSessionId } });
  if (!session) return true;
  if (session.revokedAt) return false;
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_THROTTLE_MS) {
    const ctx = requestContext.getStore();
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(), ipAddress: ctx?.ip ?? session.ipAddress },
    });
  }
  return true;
}

export async function listUserSessions(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });
}

// `ownerUserId` opțional — dacă dat, revocarea reușește doar dacă sesiunea îi aparține
// (auto-revocare); omis pentru revocarea administrativă (orice utilizator).
export async function revokeSession(sessionId: string, ownerUserId?: string) {
  const session = await prisma.userSession.findUnique({ where: { id: sessionId } });
  if (!session || (ownerUserId && session.userId !== ownerUserId)) return null;
  return prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}
