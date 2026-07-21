import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { logHistoryDiff } from "./history";

export const federationsRouter = Router();

const federationSchema = z.object({
  name: z.string().min(1),
  disciplineType: z.string().min(1),
  orgType: z.enum(["NATIONAL_FEDERATION", "COUNTY_ASSOCIATION", "PROFESSIONAL_LEAGUE"]).default("NATIONAL_FEDERATION"),
  county: z.string().optional(),
  cif: z.string().optional(),
  address: z.string().optional(),
  foundedAt: z.string().optional(),
});

// "Max o asociație/ramură/județ" (cerință 4.5.3) — validare la nivel de aplicație
// (Prisma nu suportă unique index parțial), normalizare simplă lowercase+trim.
async function assertCountyAssociationUnique(disciplineType: string, county: string | undefined, excludeId?: string) {
  if (!county) return;
  const normalizedDiscipline = disciplineType.trim().toLowerCase();
  const normalizedCounty = county.trim().toLowerCase();
  const existing = await prisma.sportsFederation.findMany({
    where: { orgType: "COUNTY_ASSOCIATION", id: excludeId ? { not: excludeId } : undefined },
  });
  const duplicate = existing.find(
    (f) => f.disciplineType.trim().toLowerCase() === normalizedDiscipline && f.county?.trim().toLowerCase() === normalizedCounty
  );
  if (duplicate) throw new Error(`Există deja o asociație județeană pentru „${disciplineType}" în județul „${county}"`);
}

federationsRouter.get("/federations", requireAuth, requireStaff(), async (_req, res) => {
  const federations = await prisma.sportsFederation.findMany({
    include: { _count: { select: { clubs: true, coaches: true } } },
    orderBy: { name: "asc" },
  });
  res.json(federations);
});

federationsRouter.post("/federations", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = federationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    await assertCountyAssociationUnique(parsed.data.disciplineType, parsed.data.county);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  const federation = await prisma.sportsFederation.create({
    data: { ...parsed.data, foundedAt: parsed.data.foundedAt ? new Date(parsed.data.foundedAt) : undefined },
  });
  await logAction({ userId: req.user!.id, action: "FEDERATION_CREATED", resource: `federation:${federation.id}` });
  res.status(201).json(federation);
});

federationsRouter.get("/federations/:id", requireAuth, requireStaff(), async (req, res) => {
  const federation = await prisma.sportsFederation.findUnique({
    where: { id: req.params.id },
    include: { clubs: true, coaches: true, calendars: { orderBy: { publishedAt: "desc" } } },
  });
  if (!federation) return res.status(404).json({ error: "Federație inexistentă" });
  res.json(federation);
});

const updateFederationSchema = federationSchema.partial().extend({ isMajorChange: z.boolean().optional() });

federationsRouter.patch("/federations/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const existing = await prisma.sportsFederation.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Federație inexistentă" });

  const parsed = updateFederationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { isMajorChange, foundedAt, ...data } = parsed.data;

  if (data.county !== undefined || data.disciplineType !== undefined) {
    try {
      await assertCountyAssociationUnique(data.disciplineType ?? existing.disciplineType, data.county ?? existing.county ?? undefined, existing.id);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  const updated = await prisma.sportsFederation.update({
    where: { id: existing.id },
    data: { ...data, foundedAt: foundedAt ? new Date(foundedAt) : undefined },
  });

  await logHistoryDiff("FEDERATION", existing.id, existing, updated, ["name", "address"], !!isMajorChange);
  await logAction({ userId: req.user!.id, action: "FEDERATION_UPDATED", resource: `federation:${updated.id}` });
  res.json(updated);
});

federationsRouter.get("/federations/:id/history", requireAuth, requireStaff(), async (req, res) => {
  const history = await prisma.orgHistoryEntry.findMany({
    where: { entityType: "FEDERATION", entityId: req.params.id },
    orderBy: { changedAt: "desc" },
  });
  res.json(history);
});

const calendarSchema = z.object({
  season: z.string().min(1),
  events: z.array(z.object({ name: z.string(), date: z.string(), location: z.string().optional() })),
});

// Calendar competițional versionat (cerință 4.5.3) — fiecare publicare e o versiune
// nouă imuabilă, nu un update in-place peste versiunea anterioară.
federationsRouter.post("/federations/:id/calendar", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = calendarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const lastVersion = await prisma.competitionCalendarVersion.findFirst({
    where: { federationId: req.params.id, season: parsed.data.season },
    orderBy: { version: "desc" },
  });
  const calendar = await prisma.competitionCalendarVersion.create({
    data: {
      federationId: req.params.id,
      season: parsed.data.season,
      version: (lastVersion?.version ?? 0) + 1,
      events: parsed.data.events,
    },
  });
  await logAction({ userId: req.user!.id, action: "CALENDAR_PUBLISHED", resource: `federation:${req.params.id}`, metadata: { version: calendar.version } });
  res.status(201).json(calendar);
});
