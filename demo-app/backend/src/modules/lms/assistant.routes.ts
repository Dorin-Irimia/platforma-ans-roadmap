import { Router } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { newStoragePath, writeFile } from "../../shared/storage";
import { extractText } from "../../shared/textExtract";
import { chatCompletion } from "../../shared/ai";
import { hasCourseAccess, requireCourseCreator } from "./rbac";

export const lmsAssistantRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

const MAX_RESOURCE_EXCERPT = 1500;

// Materiale pentru "adaptarea" asistentului (pct. 3) — textul extras chiar ajunge în
// promptul de sistem (grounding real), la fel cum baza de cunoștințe a Chatbot-ului
// (`ChatKnowledgeDocument`) fundamentează răspunsurile acolo. Nu antrenează niciun model.
async function buildResourceContext(): Promise<string | null> {
  const resources = await prisma.lmsAssistantResource.findMany({
    where: { extractedText: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  if (!resources.length) return null;
  return resources
    .map((r) => `[Material: ${r.filename}]:\n${(r.extractedText || "").slice(0, MAX_RESOURCE_EXCERPT)}`)
    .join("\n\n");
}

// Intenții personalizabile (pct. 4) — ecran real de creare/editare, nu doar config JSON.
const intentSchema = z.object({
  name: z.string().min(1),
  triggerPhrases: z.array(z.string().min(1)).min(1),
  responseMode: z.enum(["CANNED", "AI"]),
  cannedResponse: z.string().optional(),
});

lmsAssistantRouter.get("/courses/:id/intents", requireAuth, async (req, res) => {
  const intents = await prisma.lmsIntent.findMany({ where: { courseId: req.params.id }, orderBy: { createdAt: "asc" } });
  res.json(intents);
});

lmsAssistantRouter.post("/courses/:id/intents", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = intentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const intent = await prisma.lmsIntent.create({ data: { courseId: req.params.id, ...parsed.data } });
  res.status(201).json(intent);
});

lmsAssistantRouter.patch("/intents/:id", requireAuth, async (req: AuthedRequest, res) => {
  const intent = await prisma.lmsIntent.findUnique({ where: { id: req.params.id } });
  if (!intent) return res.status(404).json({ error: "Intenție inexistentă" });
  if (!(await hasCourseAccess(intent.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = intentSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.lmsIntent.update({ where: { id: intent.id }, data: parsed.data });
  res.json(updated);
});

lmsAssistantRouter.delete("/intents/:id", requireAuth, async (req: AuthedRequest, res) => {
  const intent = await prisma.lmsIntent.findUnique({ where: { id: req.params.id } });
  if (!intent) return res.status(404).json({ error: "Intenție inexistentă" });
  if (!(await hasCourseAccess(intent.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsIntent.delete({ where: { id: intent.id } });
  res.json({ deleted: true });
});

// Setări asistent (singleton global) — limbă/ton (pct. 2), glosar de terminologie
// (pct. 3), pași de fallback / "flux conversațional" (pct. 5).
const settingsSchema = z.object({
  language: z.string().optional(),
  tone: z.string().optional(),
  domainTerms: z.array(z.string()).optional(),
  fallbackSteps: z.array(z.object({ order: z.number(), prompt: z.string() })).optional(),
  stalledAfterDays: z.number().int().min(1).optional(),
});

lmsAssistantRouter.get("/assistant-settings", requireAuth, async (_req, res) => {
  const settings = await prisma.lmsAssistantSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  res.json(settings);
});

lmsAssistantRouter.patch("/assistant-settings", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const settings = await prisma.lmsAssistantSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data as any,
    create: { id: "singleton", ...parsed.data } as any,
  });
  res.json(settings);
});

// Potrivire simplă pe fraze-declanșator (substring, case-insensitive) — dacă niciun
// intent nu se potrivește, trece pe pașii de fallback + AI ca sursă de răspuns.
async function matchAndRespond(courseId: string, message: string): Promise<{ matchedIntent: string | null; response: string }> {
  const intents = await prisma.lmsIntent.findMany({ where: { courseId } });
  const lower = message.toLowerCase();
  const matched = intents.find((i) => i.triggerPhrases.some((p) => lower.includes(p.toLowerCase())));

  if (matched && matched.responseMode === "CANNED" && matched.cannedResponse) {
    return { matchedIntent: matched.name, response: matched.cannedResponse };
  }

  const settings = await prisma.lmsAssistantSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const fallbackSteps = (settings.fallbackSteps as { order: number; prompt: string }[]) || [];
  const systemParts = [
    `Ești asistentul de învățare al cursului. Răspunde în limba ${settings.language === "ro" ? "română" : settings.language}, cu un ton ${settings.tone}.`,
  ];
  if (settings.domainTerms.length) systemParts.push(`Terminologie specifică domeniului: ${settings.domainTerms.join(", ")}.`);
  if (fallbackSteps.length) systemParts.push(`Dacă întrebarea nu e clară, urmează acești pași: ${fallbackSteps.map((s) => s.prompt).join(" → ")}`);
  const resourceContext = await buildResourceContext();
  if (resourceContext) systemParts.push(`Materiale de referință (folosește-le ca sursă de adevăr):\n${resourceContext}`);

  try {
    const response = await chatCompletion([
      { role: "system", content: systemParts.join(" ") },
      { role: "user", content: message },
    ]);
    return { matchedIntent: matched?.name || null, response };
  } catch (e: any) {
    return { matchedIntent: matched?.name || null, response: `Nu am putut contacta serviciul AI (${e?.message || "eroare"}).` };
  }
}

// Panou de test/optimizare interacțiuni (pct. 6) — fără persistență, doar arată ce
// intent s-a potrivit + răspunsul, ca admin/autor să regleze intențiile.
const testSchema = z.object({ courseId: z.string(), message: z.string().min(1) });

lmsAssistantRouter.post("/assistant/test", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!(await hasCourseAccess(parsed.data.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const result = await matchAndRespond(parsed.data.courseId, parsed.data.message);
  res.json(result);
});

// Asistent de învățare la nivel de lecție (pct. 1) — interfață hibridă voce-text
// (transcrierea vocală e client-side, Web Speech API); context = conținutul lecției.
const askSchema = z.object({ question: z.string().min(1) });

lmsAssistantRouter.post("/lessons/:id/ask", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const content = Array.isArray(lesson.content) ? (lesson.content as any[]) : [];
  const lessonText = content.filter((b) => b.type === "TEXT").map((b) => b.text).join("\n\n");

  const intents = await prisma.lmsIntent.findMany({ where: { courseId: lesson.courseId } });
  const lower = parsed.data.question.toLowerCase();
  const matched = intents.find((i) => i.triggerPhrases.some((p) => lower.includes(p.toLowerCase())));
  if (matched && matched.responseMode === "CANNED" && matched.cannedResponse) {
    return res.json({ response: matched.cannedResponse });
  }

  const resourceContext = await buildResourceContext();
  const systemParts = [
    `Ești asistentul de învățare pentru lecția "${lesson.title}". Context lecție:\n${lessonText.slice(0, 4000)}\n\nRăspunde în română, pe baza acestui conținut.`,
  ];
  if (resourceContext) systemParts.push(`Materiale de referință suplimentare (folosește-le ca sursă de adevăr):\n${resourceContext}`);

  try {
    const response = await chatCompletion([
      { role: "system", content: systemParts.join("\n\n") },
      { role: "user", content: parsed.data.question },
    ]);
    res.json({ response });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || "Apelul AI a eșuat" });
  }
});

// Materiale pentru adaptarea asistentului (pct. 3) — upload/listă/ștergere, tipar
// identic cu `chatbot/documents.routes.ts`.
lmsAssistantRouter.post(
  "/assistant-resources",
  requireAuth,
  requireCourseCreator(),
  upload.array("files", 5),
  async (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: "Niciun fișier trimis" });

    const created = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || "";
      const storagePath = newStoragePath("lms-assistant-resources", ext);
      writeFile(storagePath, file.buffer);
      const extractedText = await extractText(file.mimetype, file.buffer);

      const resource = await prisma.lmsAssistantResource.create({
        data: { filename: file.originalname, mimeType: file.mimetype, storagePath, extractedText },
      });
      created.push(resource);
    }

    await logAction({ userId: req.user!.id, action: "LMS_ASSISTANT_RESOURCE_UPLOADED", metadata: { count: created.length } });
    res.status(201).json(created);
  }
);

lmsAssistantRouter.get("/assistant-resources", requireAuth, async (_req, res) => {
  const resources = await prisma.lmsAssistantResource.findMany({ orderBy: { createdAt: "desc" } });
  res.json(resources);
});

lmsAssistantRouter.delete("/assistant-resources/:id", requireAuth, requireCourseCreator(), async (req: AuthedRequest, res) => {
  const resource = await prisma.lmsAssistantResource.findUnique({ where: { id: req.params.id } });
  if (!resource) return res.status(404).json({ error: "Material inexistent" });
  await prisma.lmsAssistantResource.delete({ where: { id: resource.id } });
  await logAction({ userId: req.user!.id, action: "LMS_ASSISTANT_RESOURCE_DELETED", resource: `lmsresource:${resource.id}` });
  res.json({ deleted: true });
});
