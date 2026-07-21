import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { logHistoryDiff } from "./history";
import { createInternalRequest } from "./internalRequest";

export const facilitiesRouter = Router();

const FACILITY_CATEGORIES = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9"] as const;

const facilitySchema = z.object({
  name: z.string().min(1),
  category: z.enum(FACILITY_CATEGORIES),
  county: z.string().min(1),
  address: z.string().optional(),
  ownerType: z.string().optional(),
});

facilitiesRouter.get("/facilities", requireAuth, requireStaff(), async (req, res) => {
  const { county } = req.query as Record<string, string>;
  const facilities = await prisma.sportsFacility.findMany({
    where: county ? { county } : undefined,
    include: { units: true },
    orderBy: { name: "asc" },
  });
  res.json(facilities);
});

facilitiesRouter.post("/facilities", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = facilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // O bază sportivă nouă începe INACTIVE — devine ACTIVE doar prin fluxul de omologare
  // (Workflow real, acțiunea ACTIVATE_FACILITY), nu direct la creare.
  const facility = await prisma.sportsFacility.create({ data: { ...parsed.data, status: "INACTIVE" } });
  await logAction({ userId: req.user!.id, action: "FACILITY_CREATED", resource: `facility:${facility.id}` });
  res.status(201).json(facility);
});

facilitiesRouter.get("/facilities/:id", requireAuth, requireStaff(), async (req, res) => {
  const facility = await prisma.sportsFacility.findUnique({ where: { id: req.params.id }, include: { units: true } });
  if (!facility) return res.status(404).json({ error: "Bază sportivă inexistentă" });
  res.json(facility);
});

const updateFacilitySchema = facilitySchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE", "DEMOLISHED"]).optional(),
  isMajorChange: z.boolean().optional(),
});

// Fără DELETE — doar tranziții de status (cerință explicită 4.5.5: "fără ștergere fizică").
facilitiesRouter.patch("/facilities/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const existing = await prisma.sportsFacility.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Bază sportivă inexistentă" });

  const parsed = updateFacilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { isMajorChange, ...data } = parsed.data;

  const updated = await prisma.sportsFacility.update({ where: { id: existing.id }, data });
  await logHistoryDiff("FACILITY", existing.id, existing, updated, ["name", "address", "status"], !!isMajorChange);
  await logAction({ userId: req.user!.id, action: "FACILITY_UPDATED", resource: `facility:${updated.id}` });
  res.json(updated);
});

facilitiesRouter.get("/facilities/:id/history", requireAuth, requireStaff(), async (req, res) => {
  const history = await prisma.orgHistoryEntry.findMany({ where: { entityType: "FACILITY", entityId: req.params.id }, orderBy: { changedAt: "desc" } });
  res.json(history);
});

const unitSchema = z.object({ name: z.string().min(1), unitType: z.string(), capacity: z.number().int().optional() });

facilitiesRouter.post("/facilities/:id/units", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = unitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const unit = await prisma.facilityUnit.create({ data: { facilityId: req.params.id, ...parsed.data } });
  res.status(201).json(unit);
});

// Omologare — flux ciclu de viață complet (inițiere-validare-aprobare-publicare, cerință
// 4.5.5), cerere reală în Registratură, publicată efectiv prin ACTIVATE_FACILITY.
facilitiesRouter.post("/facilities/:id/homologation-request", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const facility = await prisma.sportsFacility.findUnique({ where: { id: req.params.id } });
  if (!facility) return res.status(404).json({ error: "Bază sportivă inexistentă" });

  const request = await createInternalRequest({
    category: "omologare-baza-sportiva",
    submitterName: facility.name,
    submitterEmail: req.user!.email,
    data: { facilityId: facility.id },
  });

  await logAction({ userId: req.user!.id, action: "FACILITY_HOMOLOGATION_REQUESTED", resource: `facility:${facility.id}`, metadata: { requestId: request.id } });
  res.status(201).json(request);
});
