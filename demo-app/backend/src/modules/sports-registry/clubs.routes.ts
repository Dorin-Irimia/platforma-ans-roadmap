import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { logHistoryDiff } from "./history";

export const clubsRouter = Router();

// Regulă automată (evaluată leneș, la listare/deschidere): un club cu taxe restante de
// mai mult decât perioada de grație configurată (SportsRegistrySettings.duesGracePeriodDays)
// e suspendat automat — reutilizează exact fluxul de istoric (OrgHistoryEntry) al
// modificărilor manuale, ca să nu existe o cale "invizibilă" de schimbare a statusului.
async function applyDuesSuspensionRule(club: { id: string; status: string; duesUpToDate: boolean; duesMarkedOverdueAt: Date | null }) {
  if (club.duesUpToDate || !club.duesMarkedOverdueAt || club.status === "SUSPENDED") return club;
  const settings = await prisma.sportsRegistrySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const graceMs = settings.duesGracePeriodDays * 86_400_000;
  if (Date.now() - club.duesMarkedOverdueAt.getTime() <= graceMs) return club;

  const updated = await prisma.sportsClub.update({ where: { id: club.id }, data: { status: "SUSPENDED" } });
  await prisma.orgHistoryEntry.create({
    data: { entityType: "CLUB", entityId: club.id, field: "status", oldValue: club.status, newValue: "SUSPENDED", isMajorChange: true },
  });
  await logAction({ action: "CLUB_AUTO_SUSPENDED_DUES_OVERDUE", resource: `club:${club.id}` });
  return updated;
}

const clubSchema = z.object({
  name: z.string().min(1),
  clubType: z.enum(["MONOSPORT", "POLISPORT"]),
  federationId: z.string(),
  address: z.string().optional(),
  cif: z.string().optional(),
  foundedAt: z.string().optional(),
});

clubsRouter.get("/clubs", requireAuth, requireStaff(), async (req, res) => {
  const { federationId } = req.query as Record<string, string>;
  const clubs = await prisma.sportsClub.findMany({
    where: federationId ? { federationId } : undefined,
    include: { federation: { select: { id: true, name: true } }, _count: { select: { athletes: true, coaches: true } } },
    orderBy: { name: "asc" },
  });
  const withRule = await Promise.all(clubs.map((c) => applyDuesSuspensionRule(c)));
  res.json(clubs.map((c, i) => ({ ...c, status: withRule[i].status })));
});

clubsRouter.post("/clubs", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = clubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const club = await prisma.sportsClub.create({
    data: { ...parsed.data, foundedAt: parsed.data.foundedAt ? new Date(parsed.data.foundedAt) : undefined },
  });
  await logAction({ userId: req.user!.id, action: "CLUB_CREATED", resource: `club:${club.id}` });
  res.status(201).json(club);
});

clubsRouter.get("/clubs/:id", requireAuth, requireStaff(), async (req, res) => {
  const club = await prisma.sportsClub.findUnique({
    where: { id: req.params.id },
    include: { federation: true, athletes: true, coaches: true },
  });
  if (!club) return res.status(404).json({ error: "Club inexistent" });
  const ruled = await applyDuesSuspensionRule(club);
  res.json({ ...club, status: ruled.status });
});

const updateClubSchema = clubSchema.partial().extend({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISSOLVED", "UNDER_INVESTIGATION"]).optional(),
  isMajorChange: z.boolean().optional(),
});

clubsRouter.patch("/clubs/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const existing = await prisma.sportsClub.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Club inexistent" });

  const parsed = updateClubSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { isMajorChange, foundedAt, ...data } = parsed.data;

  const updated = await prisma.sportsClub.update({
    where: { id: existing.id },
    data: { ...data, foundedAt: foundedAt ? new Date(foundedAt) : undefined },
  });

  await logHistoryDiff("CLUB", existing.id, existing, updated, ["name", "address", "status"], !!isMajorChange);
  await logAction({ userId: req.user!.id, action: "CLUB_UPDATED", resource: `club:${updated.id}` });
  res.json(updated);
});

clubsRouter.get("/clubs/:id/history", requireAuth, requireStaff(), async (req, res) => {
  const history = await prisma.orgHistoryEntry.findMany({ where: { entityType: "CLUB", entityId: req.params.id }, orderBy: { changedAt: "desc" } });
  res.json(history);
});

// Evidența taxelor cu blocare acces la neplată (cerință 4.5.3).
clubsRouter.patch("/clubs/:id/dues", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const { duesUpToDate } = req.body as { duesUpToDate: boolean };
  const club = await prisma.sportsClub.update({
    where: { id: req.params.id },
    data: { duesUpToDate: !!duesUpToDate, duesMarkedOverdueAt: duesUpToDate ? null : new Date() },
  });
  await logAction({ userId: req.user!.id, action: "CLUB_DUES_UPDATED", resource: `club:${club.id}`, metadata: { duesUpToDate: club.duesUpToDate } });
  res.json(club);
});
