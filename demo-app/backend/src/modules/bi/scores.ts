// Scoruri avansate (cerință explicită 4.5.12: "Efficiency, Delay, Throughput, Approval
// Quality") — calculate LIVE din DmsRequest, nicio valoare stocată/pre-agregată (nu există
// încă un data warehouse STAR SCHEMA separat, dar scorurile reflectă exact aceleași
// dimensiuni pe care l-ar expune unul: conformitate termen, întârziere, volum, calitate decizie).
import { prisma } from "../../shared/prisma";
import { monthLabel } from "./metrics";

const CLOSED_STATUSES = ["FINALIZAT", "RESPINS"] as const;

// % din cererile închise care NU au depășit termenul legal (folosim `updatedAt` ca proxy
// al datei de închidere — același tipar deja documentat în metrics.ts/avgResolutionDays,
// nu există un câmp dedicat `resolvedAt`).
export async function efficiencyScore(): Promise<number> {
  const closed = await prisma.dmsRequest.findMany({
    where: { status: { in: [...CLOSED_STATUSES] }, legalDeadline: { not: null } },
    select: { updatedAt: true, legalDeadline: true },
  });
  if (closed.length === 0) return 100;
  const onTime = closed.filter((r) => r.legalDeadline && r.updatedAt <= r.legalDeadline).length;
  return Math.round((onTime / closed.length) * 100);
}

// Media zilelor de întârziere pentru cererile închise cu depășire (0 dacă nu există nicio întârziere).
export async function delayScore(): Promise<number> {
  const closed = await prisma.dmsRequest.findMany({
    where: { status: { in: [...CLOSED_STATUSES] }, legalDeadline: { not: null } },
    select: { updatedAt: true, legalDeadline: true },
  });
  const overdue = closed.filter((r) => r.legalDeadline && r.updatedAt > r.legalDeadline);
  if (overdue.length === 0) return 0;
  const totalDays = overdue.reduce((sum, r) => sum + (r.updatedAt.getTime() - r.legalDeadline!.getTime()) / 86_400_000, 0);
  return Math.round((totalDays / overdue.length) * 10) / 10;
}

export async function throughputByMonth(monthsBack = 6): Promise<{ label: string; count: number }[]> {
  const now = new Date();
  const results: { label: string; count: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const count = await prisma.dmsRequest.count({ where: { status: { in: [...CLOSED_STATUSES] }, updatedAt: { gte: start, lt: end } } });
    results.push({ label: monthLabel(d.getFullYear(), d.getMonth()), count });
  }
  return results;
}

// Scor normalizat (0-100) — cereri închise/lună relativ la un reper de 20/lună (arbitrar,
// documentat: peste 20 închise/lună = scor maxim; scop demo, nu un SLA oficial ANS).
export async function throughputScore(): Promise<number> {
  const trend = await throughputByMonth(3);
  const avg = trend.reduce((s, t) => s + t.count, 0) / (trend.length || 1);
  return Math.min(100, Math.round((avg / 20) * 100));
}

// 1 − (cereri RESPINS / total închise) — reutilizează exact statusul final calculat de
// caseEngine.ts (euristica /respin/i pe numele stării) la închiderea unui caz de workflow.
export async function approvalQualityScore(): Promise<number> {
  const total = await prisma.dmsRequest.count({ where: { status: { in: [...CLOSED_STATUSES] } } });
  if (total === 0) return 100;
  const rejected = await prisma.dmsRequest.count({ where: { status: "RESPINS" } });
  return Math.round(((total - rejected) / total) * 100);
}

export async function dailyVolumeThisYear(): Promise<{ date: string; count: number }[]> {
  const year = new Date().getFullYear();
  const rows = await prisma.dmsRequest.findMany({
    where: { registeredAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
    select: { registeredAt: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.registeredAt.toISOString().slice(0, 10);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

// Distribuția curentă pe stări, în ordinea firească a fluxului — nu e un funnel cumulativ
// istoric (nu ținem evidența "a trecut vreodată prin"), ci fotografia curentă per status,
// documentat explicit ca atare.
export async function statusFunnel(): Promise<{ stage: string; count: number }[]> {
  const [nou, inLucru, inAsteptare, finalizat] = await Promise.all([
    prisma.dmsRequest.count({ where: { status: "NOU" } }),
    prisma.dmsRequest.count({ where: { status: "IN_LUCRU" } }),
    prisma.dmsRequest.count({ where: { status: "IN_ASTEPTARE" } }),
    prisma.dmsRequest.count({ where: { status: "FINALIZAT" } }),
  ]);
  return [
    { stage: "Nou", count: nou },
    { stage: "În lucru", count: inLucru },
    { stage: "În așteptare", count: inAsteptare },
    { stage: "Finalizat", count: finalizat },
  ];
}
