// Jurnal de audit imuabil (cerință Scenariul 4 + "audit complet: IP, browser" 4.5.10).
import { prisma } from "../../shared/prisma";
import { requestContext } from "../../shared/requestContext";

export interface AuditEntryInput {
  userId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

export async function logAction(entry: AuditEntryInput) {
  // IP/user-agent vin implicit din contextul cererii curente (requestContext.ts) dacă
  // apelantul nu le-a pasat explicit — retrofit gratuit pe orice apel logAction existent,
  // fără să fie nevoie să umblăm prin fiecare rută din platformă.
  const ctx = requestContext.getStore();
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      metadata: entry.metadata as any,
      ipAddress: entry.ipAddress ?? ctx?.ip,
      userAgent: entry.userAgent ?? ctx?.userAgent,
      success: entry.success ?? true,
    },
  });
}

// Filtrare/căutare avansată — după utilizator, acțiune, resursă, status sau interval de timp,
// cu paginare (offset/limit) pentru istoricul complet, nu doar ultimele 200 de intrări.
export async function queryAuditLog(filters: {
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(filters.limit ?? 50, 200);
  return prisma.auditLog.findMany({
    where: {
      userId: filters.userId,
      action: filters.action ? { contains: filters.action, mode: "insensitive" } : undefined,
      resource: filters.resource ? { contains: filters.resource, mode: "insensitive" } : undefined,
      success: filters.success,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: filters.offset ?? 0,
  });
}
