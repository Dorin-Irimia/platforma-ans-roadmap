import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";

// Editor centralizat de șabloane email cu variabile (4.5.1 R88-89) — trimiterea rămâne
// simulată (doar logată, ca la ActionType.SEND_EMAIL din motorul de workflow existent);
// acest modul acoperă doar editarea/previzualizarea conținutului șablonului.
export const emailTemplatesRouter = Router();

const templateSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Doar litere mici, cifre, underscore și cratimă"),
  subject: z.string().min(1),
  bodyHtml: z.string(),
  variables: z.array(z.string()).default([]),
});

emailTemplatesRouter.get("/email-templates", requireAuth, requireStaff(), async (_req, res) => {
  const templates = await prisma.notificationEmailTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  res.json(templates);
});

emailTemplatesRouter.post("/email-templates", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.notificationEmailTemplate.findUnique({ where: { key: parsed.data.key } });
  if (existing) return res.status(409).json({ error: "Există deja un șablon cu această cheie" });
  const template = await prisma.notificationEmailTemplate.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "EMAIL_TEMPLATE_CREATED", resource: `email-template:${template.id}` });
  res.status(201).json(template);
});

emailTemplatesRouter.patch("/email-templates/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.notificationEmailTemplate.update({ where: { id: req.params.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "EMAIL_TEMPLATE_UPDATED", resource: `email-template:${template.id}` });
  res.json(template);
});

emailTemplatesRouter.delete("/email-templates/:id", requireAuth, requireStaff(), async (req, res) => {
  await prisma.notificationEmailTemplate.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

// Previzualizare cu valori mock pentru variabile — nu trimite nimic, doar substituie
// {{VAR}} → valoare, ca autorul șablonului să vadă rezultatul final.
emailTemplatesRouter.post("/email-templates/:id/preview", requireAuth, requireStaff(), async (req, res) => {
  const template = await prisma.notificationEmailTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: "Șablon inexistent" });
  const values = (req.body?.values as Record<string, string>) || {};
  const substitute = (text: string) => template.variables.reduce((acc, v) => acc.split(`{{${v}}}`).join(values[v] || `[${v}]`), text);
  res.json({ subject: substitute(template.subject), bodyHtml: substitute(template.bodyHtml) });
});
