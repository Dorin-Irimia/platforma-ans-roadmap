import { Request, Response, NextFunction } from "express";
import { verifyToken } from "./jwt";
import { RoleName } from "./types";

export interface AuthedRequest extends Request {
  user?: { id: string; email: string; role: RoleName };
}

// Cerință Scenariul 4: control granular al accesului bazat pe roluri (RBAC).
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token lipsă" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: "Token invalid sau expirat" });
  }
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
