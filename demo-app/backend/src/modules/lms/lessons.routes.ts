import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { hasCourseAccess } from "./rbac";

export const lmsLessonsRouter = Router();

// Bloc de conținut per lecție — stocat ca JSON (`LmsLesson.content`, array ordonat).
// Blocul QUIZ înglobează întrebările + scorul minim necesar pentru deblocarea
// următoarei lecții ("Barieră Logică", pct. 15).
const quizQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  options: z.array(z.string()).min(2),
  // Răspunsuri multiple corecte — un set de indexuri, nu un singur index.
  correctIndexes: z.array(z.number().int().min(0)).min(1),
});

const blockSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("TEXT"), text: z.string() }),
  z.object({ id: z.string(), type: z.literal("IMAGE"), url: z.string(), caption: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal("VIDEO"), url: z.string(), caption: z.string().optional() }),
  z.object({
    id: z.string(),
    type: z.literal("QUIZ"),
    questions: z.array(quizQuestionSchema).min(1),
    requiredScoreToUnlockNext: z.number().int().min(0).max(100),
  }),
]);

export type LessonBlock = z.infer<typeof blockSchema>;

async function assertCourseAccess(courseId: string, user: { id: string; role: any }) {
  return hasCourseAccess(courseId, user);
}

lmsLessonsRouter.get("/courses/:courseId/lessons", requireAuth, async (req: AuthedRequest, res) => {
  const lessons = await prisma.lmsLesson.findMany({ where: { courseId: req.params.courseId }, orderBy: { order: "asc" } });
  const locks = await computeLessonLocks(lessons, req.user!.id);
  // Nu expunem conținutul (inclusiv răspunsurile corecte din QUIZ) al lecțiilor
  // încă blocate — enforcement server-side al Barierei Logice (pct. 15), nu doar UI.
  res.json(lessons.map((l) => (locks.get(l.id) ? { ...l, content: [] } : l)));
});

const createLessonSchema = z.object({ title: z.string().min(1) });

lmsLessonsRouter.post("/courses/:courseId/lessons", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await assertCourseAccess(req.params.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = createLessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const count = await prisma.lmsLesson.count({ where: { courseId: req.params.courseId } });
  const lesson = await prisma.lmsLesson.create({
    data: { courseId: req.params.courseId, title: parsed.data.title, order: count, content: [] },
  });
  res.status(201).json(lesson);
});

const updateLessonSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.array(blockSchema).optional(),
});

lmsLessonsRouter.patch("/lessons/:id", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  if (!(await assertCourseAccess(lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });

  const parsed = updateLessonSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.lmsLesson.update({
    where: { id: lesson.id },
    data: { title: parsed.data.title, content: parsed.data.content as any },
  });
  res.json(updated);
});

lmsLessonsRouter.delete("/lessons/:id", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  if (!(await assertCourseAccess(lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsLesson.delete({ where: { id: lesson.id } });
  res.json({ deleted: true });
});

// Reordonare prin drag-and-drop — actualizare în bloc, același tipar ca la
// `PUT /widgets/layout` din modulul dashboard.
const reorderSchema = z.object({ items: z.array(z.object({ id: z.string(), order: z.number().int().min(0) })) });

lmsLessonsRouter.put("/courses/:courseId/lessons/reorder", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await assertCourseAccess(req.params.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const owned = await prisma.lmsLesson.findMany({
    where: { courseId: req.params.courseId, id: { in: parsed.data.items.map((i) => i.id) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((l) => l.id));

  await prisma.$transaction(
    parsed.data.items
      .filter((item) => ownedIds.has(item.id))
      .map((item) => prisma.lmsLesson.update({ where: { id: item.id }, data: { order: item.order } }))
  );
  res.json({ updated: true });
});

function findQuizBlock(content: unknown): Extract<LessonBlock, { type: "QUIZ" }> | null {
  if (!Array.isArray(content)) return null;
  return (content.find((b) => b?.type === "QUIZ") as any) || null;
}

type LessonRow = { id: string; content: unknown };

// Verificare "Barieră Logică" (pct. 15) — o lecție e blocată dacă lecția anterioară are
// un bloc QUIZ cu scor minim de deblocare și *ultima* tentativă a utilizatorului la acel
// quiz nu îl atinge (sau nu există nicio tentativă încă). Reutilizată atât de ruta de
// listare (pentru a nu scurge conținutul lecțiilor blocate), cât și de ruta de acces
// pentru UI, și de `quiz.routes.ts` pentru a respinge server-side o încercare pe o
// lecție încă blocată.
export async function computeLessonLocks(lessons: LessonRow[], userId: string): Promise<Map<string, boolean>> {
  const locks = new Map<string, boolean>();

  for (let i = 0; i < lessons.length; i++) {
    if (i === 0) {
      locks.set(lessons[i].id, false);
      continue;
    }
    const prevLesson = lessons[i - 1];
    const quizBlock = findQuizBlock(prevLesson.content);
    if (!quizBlock || quizBlock.requiredScoreToUnlockNext <= 0) {
      locks.set(lessons[i].id, false);
      continue;
    }
    const lastAttempt = await prisma.lmsQuizAttempt.findFirst({
      where: { lessonId: prevLesson.id, userId },
      orderBy: { createdAt: "desc" },
    });
    locks.set(lessons[i].id, !lastAttempt || lastAttempt.score < quizBlock.requiredScoreToUnlockNext);
  }

  return locks;
}

lmsLessonsRouter.get("/courses/:courseId/lessons/access", requireAuth, async (req: AuthedRequest, res) => {
  const lessons = await prisma.lmsLesson.findMany({ where: { courseId: req.params.courseId }, orderBy: { order: "asc" } });
  const locks = await computeLessonLocks(lessons, req.user!.id);
  res.json(lessons.map((l) => ({ lessonId: l.id, locked: locks.get(l.id) ?? false })));
});
