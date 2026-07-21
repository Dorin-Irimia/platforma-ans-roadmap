import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { chatCompletion } from "../../shared/ai";
import { extractText } from "../../shared/textExtract";
import { hasCourseAccess } from "./rbac";

export const lmsAiRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function extractJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Răspunsul AI nu a fost JSON valid");
  }
}

// Generare automată a structurii unui material (pct. 10) — subiect scris sau fișier
// încărcat (text extras cu același helper ca la Chatbot) → structură de lecții.
lmsAiRouter.post(
  "/ai/generate-structure",
  requireAuth,
  upload.single("file"),
  async (req: AuthedRequest, res) => {
    const courseId = req.body?.courseId as string | undefined;
    if (!courseId) return res.status(400).json({ error: "courseId lipsă" });
    if (!(await hasCourseAccess(courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });

    let subject = (req.body?.subject as string | undefined)?.trim() || "";
    if (req.file) {
      const fileText = await extractText(req.file.mimetype, req.file.buffer);
      if (fileText) subject += `\n\n${fileText}`;
    }
    if (!subject.trim()) return res.status(400).json({ error: "Ai nevoie de un subiect scris sau un fișier cu text" });

    let structure: { lessons: { title: string; text: string }[] };
    try {
      const raw = await chatCompletion([
        {
          role: "system",
          content:
            "Ești un asistent care structurează materiale didactice. Primești un subiect și trebuie să răspunzi STRICT cu JSON valid, fără text în plus, de forma " +
            '{"lessons":[{"title":"...","text":"..."}]}. Generează 3-6 lecții relevante pentru subiect, în limba română.',
        },
        { role: "user", content: subject.slice(0, 6000) },
      ]);
      structure = extractJson(raw);
    } catch (e: any) {
      return res.status(502).json({ error: e?.message || "Generarea structurii a eșuat" });
    }

    const existingCount = await prisma.lmsLesson.count({ where: { courseId } });
    const created = await prisma.$transaction(
      structure.lessons.map((l, idx) =>
        prisma.lmsLesson.create({
          data: {
            courseId,
            title: l.title,
            order: existingCount + idx,
            content: [{ id: randomUUID(), type: "TEXT", text: l.text }],
          },
        })
      )
    );
    res.status(201).json(created);
  }
);

// Rescrie/adaptează/extinde/rezumă text selectat (pct. 11, partea de text —
// Text-to-Speech e client-side, fără rută backend).
const rewriteSchema = z.object({
  text: z.string().min(1),
  instruction: z.enum(["REWRITE", "ADAPT", "EXPAND", "SUMMARIZE"]),
});

const INSTRUCTION_PROMPTS: Record<string, string> = {
  REWRITE: "Rescrie textul următor, păstrând sensul, într-un stil mai clar.",
  ADAPT: "Adaptează textul următor pentru un public de cursanți la un curs online, pe înțelesul tuturor.",
  EXPAND: "Extinde textul următor cu mai multe detalii și exemple, păstrând coerența.",
  SUMMARIZE: "Rezumă textul următor, păstrând ideile esențiale, cât mai concis.",
};

lmsAiRouter.post("/ai/rewrite", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = rewriteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const result = await chatCompletion([
      { role: "system", content: `${INSTRUCTION_PROMPTS[parsed.data.instruction]} Răspunde doar cu textul rezultat, în română, fără explicații suplimentare.` },
      { role: "user", content: parsed.data.text },
    ]);
    res.json({ result });
  } catch (e: any) {
    res.status(502).json({ error: e?.message || "Apelul AI a eșuat" });
  }
});
