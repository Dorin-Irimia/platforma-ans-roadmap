import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { createInternalRequest } from "./internalRequest";

export const coachesRouter = Router();

const coachSchema = z.object({
  cnp: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  certificationLevel: z.string().optional(),
  clubId: z.string().optional(),
  federationId: z.string().optional(),
  facilityId: z.string().optional(),
});

coachesRouter.get("/coaches", requireAuth, requireStaff(), async (req, res) => {
  const { clubId, federationId } = req.query as Record<string, string>;
  const coaches = await prisma.coach.findMany({
    where: { clubId: clubId || undefined, federationId: federationId || undefined },
    include: { club: { select: { id: true, name: true } }, federation: { select: { id: true, name: true } }, certifications: true },
    orderBy: { lastName: "asc" },
  });
  res.json(coaches);
});

coachesRouter.post("/coaches", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = coachSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const coach = await prisma.coach.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "COACH_CREATED", resource: `coach:${coach.id}` });
  res.status(201).json(coach);
});

coachesRouter.get("/coaches/:id", requireAuth, requireStaff(), async (req, res) => {
  const coach = await prisma.coach.findUnique({
    where: { id: req.params.id },
    include: { club: true, federation: true, certifications: { orderBy: { issuedAt: "desc" } } },
  });
  if (!coach) return res.status(404).json({ error: "Antrenor inexistent" });
  res.json(coach);
});

const updateCoachSchema = coachSchema.partial();

coachesRouter.patch("/coaches/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = updateCoachSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const coach = await prisma.coach.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(coach);
});

const certificationSchema = z.object({ title: z.string().min(1) });

coachesRouter.post("/coaches/:id/certifications", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = certificationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const certification = await prisma.coachCertification.create({ data: { coachId: req.params.id, title: parsed.data.title } });
  await logAction({ userId: req.user!.id, action: "COACH_CERTIFICATION_ADDED", resource: `coach:${req.params.id}` });
  res.status(201).json(certification);
});

// Ștergere GDPR — anonimizare, la fel ca la Athlete.
coachesRouter.post("/coaches/:id/gdpr-erase", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const coach = await prisma.coach.update({
    where: { id: req.params.id },
    data: { cnp: `ERASED-${req.params.id}`, firstName: "Șters", lastName: "(GDPR)", gdprErasedAt: new Date() },
  });
  await logAction({ userId: req.user!.id, action: "COACH_GDPR_ERASED", resource: `coach:${coach.id}` });
  res.json(coach);
});

// Titlu de antrenor emerit "prin flux configurabil" (cerință 4.5.4) — cerere reală în
// Registratură, acordată efectiv prin acțiunea GRANT_COACH_TITLE la finalul fluxului.
coachesRouter.post("/coaches/:id/emerit-request", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const coach = await prisma.coach.findUnique({ where: { id: req.params.id } });
  if (!coach) return res.status(404).json({ error: "Antrenor inexistent" });

  const request = await createInternalRequest({
    category: "titlu-antrenor-emerit",
    submitterName: `${coach.firstName} ${coach.lastName}`,
    submitterEmail: req.user!.email,
    data: { coachId: coach.id },
  });

  await logAction({ userId: req.user!.id, action: "COACH_EMERIT_REQUESTED", resource: `coach:${coach.id}`, metadata: { requestId: request.id } });
  res.status(201).json(request);
});
