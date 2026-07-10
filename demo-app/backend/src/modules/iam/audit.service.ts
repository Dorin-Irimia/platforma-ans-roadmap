// Jurnal de audit imuabil (cerință Scenariul 4).
import { prisma } from "../../shared/prisma";

export interface AuditEntryInput {
  userId?: string;
  action: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  success?: boolean;
}

export async function logAction(entry: AuditEntryInput) {
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      resource: entry.resource,
      metadata: entry.metadata as any,
      ipAddress: entry.ipAddress,
      success: entry.success ?? true,
    },
  });
}

// Filtrare/căutare avansată — după utilizator, acțiune sau interval de timp.
export async function queryAuditLog(filters: {
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}) {
  return prisma.auditLog.findMany({
    where: {
      userId: filters.userId,
      action: filters.action ? { contains: filters.action, mode: "insensitive" } : undefined,
      createdAt: {
        gte: filters.from,
        lte: filters.to,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
