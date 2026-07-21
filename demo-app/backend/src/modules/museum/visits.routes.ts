import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import QRCode from "qrcode";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest, optionalAuth } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";

export const visitsRouter = Router();

async function getSettings() {
  return prisma.museumSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
}

// Regulă automată: un bilet necheck-in-uit la atâtea minute după începutul intervalului
// (MuseumSettings.noShowGraceMinutes) e marcat noShow și locul e eliberat pentru rezervări
// noi — evaluată leneș, chiar la punctul natural unde contează: o rezervare nouă pentru
// același interval, înainte de a decide dacă mai există capacitate liberă.
async function releaseNoShows(visitDate: Date, timeSlot: string, graceMinutes: number) {
  const slotStartStr = timeSlot.split("-")[0]?.trim();
  const [h, m] = (slotStartStr || "00:00").split(":").map(Number);
  const slotStart = new Date(visitDate);
  slotStart.setHours(h || 0, m || 0, 0, 0);
  const cutoff = new Date(slotStart.getTime() + graceMinutes * 60_000);
  if (Date.now() <= cutoff.getTime()) return;

  const overdue = await prisma.museumVisit.findMany({
    where: { visitDate, timeSlot, checkedInAt: null, noShow: false },
  });
  for (const v of overdue) {
    await prisma.museumVisit.update({ where: { id: v.id }, data: { noShow: true } });
    await logAction({ action: "MUSEUM_VISIT_NO_SHOW_RELEASED", resource: `visit:${v.id}` });
  }
}

visitsRouter.get("/settings", async (_req, res) => {
  res.json(await getSettings());
});

const visitSchema = z.object({
  visitorName: z.string().min(1),
  visitorEmail: z.string().email(),
  visitDate: z.string(),
  timeSlot: z.string().min(1),
  peopleCount: z.number().int().min(1).max(50),
});

// Rezervare bilet public — cod unic + cod QR real, cu verificare de capacitate per
// interval orar înainte de a accepta (cerință explicită 4.5.7).
visitsRouter.post("/visits", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = visitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const settings = await getSettings();
  const visitDate = new Date(parsed.data.visitDate);

  await releaseNoShows(visitDate, parsed.data.timeSlot, settings.noShowGraceMinutes);

  const existing = await prisma.museumVisit.aggregate({
    where: { visitDate, timeSlot: parsed.data.timeSlot, noShow: false },
    _sum: { peopleCount: true },
  });
  const alreadyBooked = existing._sum.peopleCount || 0;
  if (alreadyBooked + parsed.data.peopleCount > settings.maxCapacityPerSlot) {
    return res.status(409).json({
      error: `Capacitate insuficientă pentru acest interval (${alreadyBooked}/${settings.maxCapacityPerSlot} locuri ocupate)`,
    });
  }

  const ticketCode = `MUZ-${randomUUID().slice(0, 8).toUpperCase()}`;
  const visit = await prisma.museumVisit.create({
    data: {
      ...parsed.data,
      visitDate,
      ticketCode,
      priceTotal: parsed.data.peopleCount * settings.ticketPriceRon,
    },
  });

  const qrCodeDataUrl = await QRCode.toDataURL(ticketCode);
  await logAction({ userId: req.user?.id, action: "MUSEUM_VISIT_BOOKED", resource: `visit:${visit.id}` });
  res.status(201).json({ ...visit, qrCodeDataUrl });
});

visitsRouter.get("/visits/:ticketCode", async (req, res) => {
  const visit = await prisma.museumVisit.findUnique({ where: { ticketCode: req.params.ticketCode } });
  if (!visit) return res.status(404).json({ error: "Bilet inexistent" });
  const qrCodeDataUrl = await QRCode.toDataURL(visit.ticketCode);
  res.json({ ...visit, qrCodeDataUrl });
});

visitsRouter.get("/visits", requireAuth, requireStaff(), async (req, res) => {
  const { visitDate } = req.query as Record<string, string>;
  const visits = await prisma.museumVisit.findMany({
    where: visitDate ? { visitDate: new Date(visitDate) } : undefined,
    orderBy: { visitDate: "desc" },
  });
  res.json(visits);
});

// Check-in la poartă — validează biletul (cod QR scanat/introdus) și marchează folosirea,
// închizând bucla "cod unic ... " care altfel ar rămâne doar emis, niciodată verificat.
visitsRouter.post("/visits/:ticketCode/checkin", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const visit = await prisma.museumVisit.findUnique({ where: { ticketCode: req.params.ticketCode } });
  if (!visit) return res.status(404).json({ error: "Bilet inexistent" });
  if (visit.checkedInAt) return res.status(409).json({ error: `Bilet deja folosit la ${visit.checkedInAt.toLocaleString("ro-RO")}` });

  const updated = await prisma.museumVisit.update({ where: { id: visit.id }, data: { checkedInAt: new Date() } });
  await logAction({ userId: req.user!.id, action: "MUSEUM_VISIT_CHECKED_IN", resource: `visit:${visit.id}` });
  res.json(updated);
});
