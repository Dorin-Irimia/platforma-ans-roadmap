// Interogări agregate reutilizate atât de dashboard-urile predefinite (bi.routes.ts)
// cât și de motorul NL2SQL (nl2sql.ts) — o singură sursă de adevăr pentru fiecare
// metrică, calculată din date reale (DmsRequest/User), nu simulată.
import { prisma } from "../../shared/prisma";

// Statusurile "active" (cererea încă circulă prin flux) vs. "închise" (proces încheiat) —
// distincția stă la baza calculului de backlog/termene depășite.
export const ACTIVE_STATUSES = ["NOU", "IN_LUCRU", "IN_ASTEPTARE"] as const;
export const CLOSED_STATUSES = ["FINALIZAT", "RESPINS"] as const;

const ROMANIAN_MONTHS = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
];

export function monthLabel(year: number, month0: number): string {
  return `${ROMANIAN_MONTHS[month0]} ${year}`;
}

export async function countByStatus(): Promise<{ status: string; count: number }[]> {
  const rows = await prisma.dmsRequest.groupBy({ by: ["status"], _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, count: r._count._all }));
}

export async function countByCategory(where: Record<string, any> = {}, limit = 8): Promise<{ category: string; count: number }[]> {
  const rows = await prisma.dmsRequest.groupBy({
    by: ["category"],
    where,
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ category: r.category, count: r._count._all }));
}

export async function countByDomain(where: Record<string, any> = {}, limit = 8): Promise<{ domain: string; count: number }[]> {
  const rows = await prisma.dmsRequest.groupBy({
    by: ["domain"],
    where: { ...where, domain: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { domain: "desc" } },
    take: limit,
  });
  return rows.map((r) => ({ domain: r.domain || "Nespecificat", count: r._count._all }));
}

// Cereri active al căror termen legal a fost deja depășit — grupate pe categorie sau
// domeniu, pentru dashboard-ul de conformitate și pentru NL2SQL ("care categorie are cele
// mai multe întârzieri").
export async function overdueBreakdown(groupBy: "category" | "domain" = "category", limit = 8) {
  const where = { status: { in: [...ACTIVE_STATUSES] }, legalDeadline: { lt: new Date() } };
  return groupBy === "domain" ? countByDomain(where, limit) : countByCategory(where, limit);
}

export async function overdueCount(): Promise<number> {
  return prisma.dmsRequest.count({ where: { status: { in: [...ACTIVE_STATUSES] }, legalDeadline: { lt: new Date() } } });
}

export async function nearDueCount(days = 3): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + days * 86_400_000);
  return prisma.dmsRequest.count({
    where: { status: { in: [...ACTIVE_STATUSES] }, legalDeadline: { gte: now, lte: soon } },
  });
}

export async function backlogCount(): Promise<number> {
  return prisma.dmsRequest.count({ where: { status: { in: [...ACTIVE_STATUSES] } } });
}

export async function unassignedCount(): Promise<number> {
  return prisma.dmsRequest.count({ where: { status: { in: [...ACTIVE_STATUSES] }, assignedToId: null } });
}

export async function totalRequests(): Promise<number> {
  return prisma.dmsRequest.count();
}

// Volumul de cereri înregistrate pe lună, ultimele `monthsBack` luni (implicit trecutul
// recent) — folosit atât ca trend de volum, cât și ca aproximare a evoluției conformității.
export async function volumeTrendByMonth(monthsBack = 6, filterYear?: number): Promise<{ label: string; count: number }[]> {
  const now = new Date();
  const months: { year: number; month0: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month0: d.getMonth() });
  }
  const filtered = filterYear ? months.filter((m) => m.year === filterYear) : months;

  const results: { label: string; count: number }[] = [];
  for (const m of filtered) {
    const start = new Date(m.year, m.month0, 1);
    const end = new Date(m.year, m.month0 + 1, 1);
    const count = await prisma.dmsRequest.count({ where: { registeredAt: { gte: start, lt: end } } });
    results.push({ label: monthLabel(m.year, m.month0), count });
  }
  return results;
}

export async function workloadByUser(limit = 10): Promise<{ userId: string; name: string; count: number }[]> {
  const rows = await prisma.dmsRequest.groupBy({
    by: ["assignedToId"],
    where: { assignedToId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
    orderBy: { _count: { assignedToId: "desc" } },
    take: limit,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.assignedToId as string) } },
    select: { id: true, name: true, email: true },
  });
  const byId = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]));
  return rows.map((r) => ({ userId: r.assignedToId as string, name: byId[r.assignedToId as string] || "?", count: r._count._all }));
}

export async function workloadByGroup(limit = 10): Promise<{ groupId: string; name: string; count: number }[]> {
  const rows = await prisma.dmsRequest.groupBy({
    by: ["assignedGroupId"],
    where: { assignedGroupId: { not: null }, status: { in: [...ACTIVE_STATUSES] } },
    _count: { _all: true },
    orderBy: { _count: { assignedGroupId: "desc" } },
    take: limit,
  });
  const groups = await prisma.group.findMany({
    where: { id: { in: rows.map((r) => r.assignedGroupId as string) } },
    select: { id: true, name: true },
  });
  const byId = Object.fromEntries(groups.map((g) => [g.id, g.name]));
  return rows.map((r) => ({ groupId: r.assignedGroupId as string, name: byId[r.assignedGroupId as string] || "?", count: r._count._all }));
}

export async function staffUserCount(): Promise<number> {
  return prisma.user.count({ where: { role: { not: "UTILIZATOR_STANDARD" } } });
}

// Timp mediu de soluționare — aproximare: diferența dintre `updatedAt` (ultima
// modificare, la finalizare) și `registeredAt`, pentru cererile FINALIZAT. Nu există
// un câmp dedicat `resolvedAt`, deci e o aproximare documentată, nu o valoare exactă.
export async function avgResolutionDays(): Promise<number | null> {
  const finalized = await prisma.dmsRequest.findMany({
    where: { status: "FINALIZAT" },
    select: { registeredAt: true, updatedAt: true },
    take: 500,
  });
  if (finalized.length === 0) return null;
  const totalDays = finalized.reduce((sum, r) => sum + (r.updatedAt.getTime() - r.registeredAt.getTime()) / 86_400_000, 0);
  return Math.round((totalDays / finalized.length) * 10) / 10;
}

export async function distinctCategories(): Promise<string[]> {
  const rows = await prisma.dmsRequest.findMany({ distinct: ["category"], select: { category: true } });
  return rows.map((r) => r.category);
}

export async function distinctDomains(): Promise<string[]> {
  const rows = await prisma.dmsRequest.findMany({ distinct: ["domain"], select: { domain: true }, where: { domain: { not: null } } });
  return rows.map((r) => r.domain as string);
}
