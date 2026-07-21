import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../../shared/supabase";
import { prisma } from "../../shared/prisma";
import { RoleName } from "./types";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; role: RoleName };
}

// Validează tokenul Bearer contra Supabase Auth, apoi rezolvă rolul/starea contului
// din tabela locală User (Supabase deține doar credențialele/sesiunea).
async function resolveUser(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  const localUser = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!localUser || !localUser.isActive) return null;
  return { id: localUser.id, email: localUser.email, role: localUser.role as RoleName };
}

// Cerință Scenariul 4: control granular al accesului bazat pe roluri (RBAC).
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token lipsă" });
  }
  const user = await resolveUser(header.slice(7));
  if (!user) return res.status(401).json({ error: "Token invalid sau expirat" });
  req.user = user;
  next();
}

// Autentificare opțională — populează req.user dacă e prezent un token valid, dar nu
// respinge cererea dacă lipsește. Folosită de rutele Portalului public, care trebuie să
// se comporte diferit pentru vizitatori neautentificați față de cetățeni autentificați
// (Scenariul 1, pct. 5), fără a bloca accesul anonim.
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const user = await resolveUser(header.slice(7));
    if (user) req.user = user;
  }
  next();
}

// Roluri cu drept de administrare (aliniat cu lista din caiet:
// Super Admin, Admin Instituție, Moderator, Evaluator, Autor, Co-autor, Utilizator standard)
export function requireRole(...allowed: RoleName[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Neautentificat" });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Acces interzis pentru rolul curent", role: req.user.role });
    }
    next();
  };
}
