import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { createInternalRequest } from "./internalRequest";

export const cisRouter = Router();

cisRouter.get("/certificates", requireAuth, requireStaff(), async (req, res) => {
  const { entityType, entityId } = req.query as Record<string, string>;
  const certificates = await prisma.sportsIdentityCertificate.findMany({
    where: { entityType: entityType as any, entityId },
    orderBy: { issuedAt: "desc" },
  });
  res.json(certificates);
});

// Emitere CIS "condiție de funcționare legală" (cerință 4.5.3) — cerere reală în
// Registratură; emiterea efectivă (numărul certificatului) se produce prin acțiunea
// ISSUE_CIS la finalul fluxului de Workflow configurat pentru categoria "cis-federatie"/"cis-club".
const cisRequestSchema = z.object({
  entityType: z.enum(["FEDERATION", "CLUB"]),
  entityId: z.string(),
});

cisRouter.post("/cis-request", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = cisRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const entityName =
    parsed.data.entityType === "FEDERATION"
      ? (await prisma.sportsFederation.findUnique({ where: { id: parsed.data.entityId } }))?.name
      : (await prisma.sportsClub.findUnique({ where: { id: parsed.data.entityId } }))?.name;
  if (!entityName) return res.status(404).json({ error: "Entitate inexistentă" });

  const request = await createInternalRequest({
    category: parsed.data.entityType === "FEDERATION" ? "cis-federatie" : "cis-club",
    submitterName: entityName,
    submitterEmail: req.user!.email,
    data: { cisEntityType: parsed.data.entityType, cisEntityId: parsed.data.entityId },
  });

  await logAction({ userId: req.user!.id, action: "CIS_REQUESTED", metadata: { requestId: request.id, ...parsed.data } });
  res.status(201).json(request);
});

// Suspendare/retragere directă (fără flux — acțiune administrativă simplă, spre
// deosebire de emitere, care necesită adjudecare).
const statusSchema = z.object({ status: z.enum(["ISSUED", "SUSPENDED", "REVOKED"]) });

cisRouter.patch("/certificates/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const certificate = await prisma.sportsIdentityCertificate.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  await logAction({ userId: req.user!.id, action: "CIS_STATUS_UPDATED", resource: `cis:${certificate.id}`, metadata: parsed.data });
  res.json(certificate);
});
