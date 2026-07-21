import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { createInternalRequest } from "./internalRequest";

export const athletesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const athleteSchema = z.object({
  cnp: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().optional(),
  clubId: z.string().optional(),
  medicalVisaExpiresAt: z.string().optional(),
});

athletesRouter.get("/athletes", requireAuth, requireStaff(), async (req, res) => {
  const { clubId } = req.query as Record<string, string>;
  const athletes = await prisma.athlete.findMany({
    where: clubId ? { clubId } : undefined,
    include: { club: { select: { id: true, name: true } } },
    orderBy: { lastName: "asc" },
  });
  res.json(athletes);
});

athletesRouter.post("/athletes", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = athleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const athlete = await prisma.athlete.create({
    data: {
      ...parsed.data,
      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : undefined,
      medicalVisaExpiresAt: parsed.data.medicalVisaExpiresAt ? new Date(parsed.data.medicalVisaExpiresAt) : undefined,
    },
  });
  await logAction({ userId: req.user!.id, action: "ATHLETE_CREATED", resource: `athlete:${athlete.id}` });
  res.status(201).json(athlete);
});

athletesRouter.get("/athletes/:id", requireAuth, requireStaff(), async (req, res) => {
  const athlete = await prisma.athlete.findUnique({
    where: { id: req.params.id },
    include: { club: true, results: { orderBy: { date: "desc" } }, transfers: { orderBy: { createdAt: "desc" } } },
  });
  if (!athlete) return res.status(404).json({ error: "Sportiv inexistent" });
  res.json(athlete);
});

const updateAthleteSchema = athleteSchema.partial();

athletesRouter.patch("/athletes/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = updateAthleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { birthDate, medicalVisaExpiresAt, ...rest } = parsed.data;
  const athlete = await prisma.athlete.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      birthDate: birthDate ? new Date(birthDate) : undefined,
      medicalVisaExpiresAt: medicalVisaExpiresAt ? new Date(medicalVisaExpiresAt) : undefined,
    },
  });
  res.json(athlete);
});

// Verificare eligibilitate participare la competiții — viză medicală expirată blochează
// automat (cerință 4.5.3), evaluată leneș la citire (fără scheduler/cron în acest demo).
athletesRouter.get("/athletes/:id/eligibility", requireAuth, requireStaff(), async (req, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { id: req.params.id }, include: { club: true } });
  if (!athlete) return res.status(404).json({ error: "Sportiv inexistent" });

  const visaExpired = athlete.medicalVisaExpiresAt ? athlete.medicalVisaExpiresAt.getTime() < Date.now() : true;
  const clubDuesBlocked = athlete.club ? !athlete.club.duesUpToDate : false;
  const eligible = !visaExpired && !clubDuesBlocked;

  res.json({
    eligible,
    reasons: [
      ...(visaExpired ? ["Viză medicală expirată sau nesetată"] : []),
      ...(clubDuesBlocked ? ["Clubul are taxe restante"] : []),
    ],
  });
});

// Import în masă — CSV (nu Excel, scope cut asumat explicit), coloane: cnp,firstName,lastName,clubId
athletesRouter.post("/athletes/import", requireAuth, requireStaff(), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Niciun fișier trimis" });
  const text = req.file.buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const [header, ...rows] = lines;
  const columns = header.split(",").map((c) => c.trim());

  const created = [];
  for (const row of rows) {
    const values = row.split(",").map((v) => v.trim());
    const record: Record<string, string> = {};
    columns.forEach((col, i) => (record[col] = values[i]));
    if (!record.cnp || !record.firstName || !record.lastName) continue;
    const athlete = await prisma.athlete.create({
      data: { cnp: record.cnp, firstName: record.firstName, lastName: record.lastName, clubId: record.clubId || undefined },
    });
    created.push(athlete);
  }

  await logAction({ userId: req.user!.id, action: "ATHLETES_IMPORTED", metadata: { count: created.length } });
  res.status(201).json({ imported: created.length, athletes: created });
});

// Ștergere GDPR — anonimizare, nu ștergere fizică (istoricul de competiții/transferuri
// rămâne intact pentru Anuarul Sportului, cerință transversală).
athletesRouter.post("/athletes/:id/gdpr-erase", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const athlete = await prisma.athlete.update({
    where: { id: req.params.id },
    data: { cnp: `ERASED-${req.params.id}`, firstName: "Șters", lastName: "(GDPR)", gdprErasedAt: new Date() },
  });
  await logAction({ userId: req.user!.id, action: "ATHLETE_GDPR_ERASED", resource: `athlete:${athlete.id}` });
  res.json(athlete);
});

// Inițiere transfer — creează o Cerere reală în Registratură + rândul de transfer
// (PENDING); aprobarea efectivă se face prin motorul de Workflow (acțiunea
// APPROVE_TRANSFER atașată tranziției finale a fluxului configurat pentru transferuri).
const transferSchema = z.object({
  toClubId: z.string(),
  transferType: z.enum(["PERMANENT", "TEMPORARY"]),
});

athletesRouter.post("/athletes/:id/transfer-request", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const athlete = await prisma.athlete.findUnique({ where: { id: req.params.id } });
  if (!athlete) return res.status(404).json({ error: "Sportiv inexistent" });
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transfer = await prisma.athleteTransfer.create({
    data: { athleteId: athlete.id, fromClubId: athlete.clubId, toClubId: parsed.data.toClubId, transferType: parsed.data.transferType },
  });

  const request = await createInternalRequest({
    category: "transfer-sportiv",
    submitterName: `${athlete.firstName} ${athlete.lastName}`,
    submitterEmail: req.user!.email,
    data: { transferId: transfer.id, athleteId: athlete.id, fromClubId: athlete.clubId, toClubId: parsed.data.toClubId },
  });

  await prisma.athleteTransfer.update({ where: { id: transfer.id }, data: { sourceRequestId: request.id } });
  await logAction({ userId: req.user!.id, action: "TRANSFER_REQUESTED", resource: `athlete:${athlete.id}`, metadata: { requestId: request.id } });

  res.status(201).json({ transfer: { ...transfer, sourceRequestId: request.id }, request });
});
