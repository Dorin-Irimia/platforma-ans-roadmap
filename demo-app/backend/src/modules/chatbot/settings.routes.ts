import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin } from "./rbac";

export const chatbotSettingsRouter = Router();

const DEFAULTS = { escalationKeywords: ["reclamație", "urgent", "avocat", "plângere", "instanță"] };

export async function getChatbotSettings() {
  const row = await prisma.chatbotSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", ...DEFAULTS } });
  return row;
}

chatbotSettingsRouter.get("/settings", requireAuth, requireAdmin(), async (_req, res) => {
  res.json(await getChatbotSettings());
});

const updateSchema = z.object({ escalationKeywords: z.array(z.string().min(1)) });

chatbotSettingsRouter.patch("/settings", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.chatbotSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });
  await logAction({ userId: req.user!.id, action: "CHATBOT_SETTINGS_UPDATED", metadata: parsed.data });
  res.json(updated);
});
