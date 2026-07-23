import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";

// "Contul meu" (4.5.1 R14-R19, R44-R48) — profil scoped pe rolul de stakeholder al
// contului autentificat. Fiecare rol vede o formă diferită de date, toate derivate din
// entitatea de domeniu legată explicit din /admin (User.athleteProfile/clubProfile/
// federationProfile) — nu există date proprii duplicate aici, doar agregare read-mostly.
export const portalMeRouter = Router();

portalMeRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const { role, id: userId } = req.user!;

  if (role === "SPORTIV") {
    const athlete = await prisma.athlete.findUnique({
      where: { userId },
      include: {
        club: { select: { id: true, name: true } },
        results: { orderBy: { date: "desc" } },
        transfers: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!athlete) return res.json({ role, linked: false });
    return res.json({ role, linked: true, athlete });
  }

  if (role === "CLUB") {
    const club = await prisma.sportsClub.findUnique({
      where: { userId },
      include: { athletes: { select: { id: true, firstName: true, lastName: true, status: true, medicalVisaExpiresAt: true } } },
    });
    if (!club) return res.json({ role, linked: false });
    return res.json({ role, linked: true, club });
  }

  if (role === "FEDERATIE") {
    const federation = await prisma.sportsFederation.findUnique({
      where: { userId },
      include: {
        clubs: { select: { id: true, name: true, status: true, county: true } },
        calendars: { orderBy: { publishedAt: "desc" }, take: 5 },
      },
    });
    if (!federation) return res.json({ role, linked: false });
    return res.json({ role, linked: true, federation });
  }

  if (role === "CNFPA") {
    const [coursesAuthored, totalEnrollments, totalCertificates] = await Promise.all([
      prisma.lmsCourse.count({ where: { OR: [{ authorId: userId }, { collaborators: { some: { userId } } }] } }),
      prisma.lmsEnrollment.count(),
      prisma.lmsCertificate.count(),
    ]);
    return res.json({ role, linked: true, cnfpaStats: { coursesAuthored, totalEnrollments, totalCertificates } });
  }

  // UTILIZATOR_STANDARD sau alt rol fără profil de stakeholder dedicat.
  res.json({ role, linked: false });
});

const contactSchema = z.object({
  name: z.string().min(1).optional(),
});

// Date de contact proprii (4.5.1 R45) — doar `name`-ul contului IAM e editabil aici;
// emailul rămâne identificatorul unic gestionat de Supabase Auth (neschimbabil din SPV).
portalMeRouter.patch("/me/contact", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.user.update({ where: { id: req.user!.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "PORTAL_CONTACT_UPDATED", resource: `user:${req.user!.id}` });
  res.json({ id: updated.id, email: updated.email, name: updated.name });
});

// Istoricul cererilor proprii depuse din Portal (R48) — reutilizează DmsRequest.submitterId,
// deja populat de rutele existente ale Portalului; nu duplicăm datele aici.
portalMeRouter.get("/me/requests", requireAuth, async (req: AuthedRequest, res) => {
  const requests = await prisma.dmsRequest.findMany({
    where: { submitterId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, registryNumber: true, category: true, status: true, createdAt: true, legalDeadline: true },
  });
  res.json(requests);
});

const transferSchema = z.object({
  toClubId: z.string(),
  transferType: z.enum(["PERMANENT", "TEMPORARY"]),
});

// Inițiere transfer de către sportivul însuși (R14) — deleagă către logica deja existentă
// în sports-registry/athletes.routes.ts (aceeași rută, deschisă acum și pentru cont propriu).
portalMeRouter.post("/me/transfer-request", requireAuth, async (req: AuthedRequest, res) => {
  if (req.user!.role !== "SPORTIV") return res.status(403).json({ error: "Doar conturile de sportiv pot iniția un transfer" });
  const athlete = await prisma.athlete.findUnique({ where: { userId: req.user!.id } });
  if (!athlete) return res.status(404).json({ error: "Contul tău nu este asociat niciunui profil de sportiv" });
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const transfer = await prisma.athleteTransfer.create({
    data: { athleteId: athlete.id, fromClubId: athlete.clubId, toClubId: parsed.data.toClubId, transferType: parsed.data.transferType },
  });
  await logAction({ userId: req.user!.id, action: "TRANSFER_REQUESTED", resource: `athlete:${athlete.id}`, metadata: { transferId: transfer.id } });
  res.status(201).json(transfer);
});
