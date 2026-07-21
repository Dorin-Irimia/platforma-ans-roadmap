// Context per-cerere (IP + user-agent) — cerință "Audit complet: IP, browser" (4.5.10).
// AsyncLocalStorage propagă aceste valori prin întregul lanț async al cererii curente,
// fără să fie nevoie ca fiecare din cele ~100+ apeluri logAction() din tot codul să
// primească explicit req.ip/req.get("user-agent") — logAction() le citește automat
// de aici dacă nu sunt pasate explicit (vezi iam/audit.service.ts).
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  requestContext.run({ ip: req.ip, userAgent: req.get("user-agent") }, next);
}
