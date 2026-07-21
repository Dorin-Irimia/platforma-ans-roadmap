import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin } from "./rbac";

export const chatVariablesRouter = Router();

// Registru reutilizabil de variabile (pct. 5) — un șablon le referă doar prin cheie
// (`ChatDocumentTemplate.variables: string[]`), fără nicio schimbare la substituția {{KEY}}.
const variableSchema = z.object({
  key: z
    .string()
    .min(1)
    .transform((v) => v.trim().toUpperCase().replace(/\s+/g, "_")),
  label: z.string().min(1),
  description: z.string().optional(),
});

// Listă vizibilă oricărui cont autentificat (nu doar admin) — folosită și la afișarea
// etichetei prietenoase în modalul de generare document din conversație (pct. 9),
// același nivel de acces ca `templates/available`.
chatVariablesRouter.get("/variables", requireAuth, async (_req, res) => {
  const variables = await prisma.chatVariable.findMany({ orderBy: { key: "asc" } });
  res.json(variables);
});

chatVariablesRouter.post("/variables", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = variableSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existing = await prisma.chatVariable.findUnique({ where: { key: parsed.data.key } });
  if (existing) return res.status(409).json({ error: `Variabila ${parsed.data.key} există deja` });
  const variable = await prisma.chatVariable.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CHATBOT_VARIABLE_CREATED", resource: `chatvariable:${variable.id}` });
  res.status(201).json(variable);
});

chatVariablesRouter.patch("/variables/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = variableSchema.omit({ key: true }).partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const variable = await prisma.chatVariable.update({ where: { id: req.params.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "CHATBOT_VARIABLE_UPDATED", resource: `chatvariable:${variable.id}` });
  res.json(variable);
});

chatVariablesRouter.delete("/variables/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  await prisma.chatVariable.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "CHATBOT_VARIABLE_DELETED", resource: `chatvariable:${req.params.id}` });
  res.json({ deleted: true });
});
