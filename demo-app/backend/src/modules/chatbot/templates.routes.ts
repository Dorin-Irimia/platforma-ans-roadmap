import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin } from "./rbac";

export const chatTemplatesRouter = Router();

// Șabloane de documente cu variabile {{VAR}} — creare/editare/ștergere (pct. 4, 5).
const templateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  body: z.string().min(1),
  variables: z.array(z.string().min(1)).default([]),
  requiredAttachments: z.array(z.string().min(1)).default([]),
});

chatTemplatesRouter.get("/templates", requireAuth, requireAdmin(), async (_req, res) => {
  const templates = await prisma.chatDocumentTemplate.findMany({ orderBy: { createdAt: "desc" } });
  res.json(templates);
});

// Listă redusă (fără `body`), vizibilă oricărui cont autentificat — folosită la
// selectarea unui șablon în timpul unei conversații, pentru generarea unui document (pct. 9).
chatTemplatesRouter.get("/templates/available", requireAuth, async (_req, res) => {
  const templates = await prisma.chatDocumentTemplate.findMany({
    select: { id: true, name: true, category: true, variables: true, requiredAttachments: true },
    orderBy: { name: "asc" },
  });
  res.json(templates);
});

chatTemplatesRouter.post("/templates", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.chatDocumentTemplate.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CHATBOT_TEMPLATE_CREATED", resource: `chattemplate:${template.id}` });
  res.status(201).json(template);
});

chatTemplatesRouter.patch("/templates/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.chatDocumentTemplate.update({ where: { id: req.params.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CHATBOT_TEMPLATE_UPDATED", resource: `chattemplate:${template.id}` });
  res.json(template);
});

chatTemplatesRouter.delete("/templates/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  await prisma.chatDocumentTemplate.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "CHATBOT_TEMPLATE_DELETED", resource: `chattemplate:${req.params.id}` });
  res.json({ deleted: true });
});
