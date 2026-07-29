import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { hasCourseAccess } from "./rbac";
import { canAccessPublishedCourse, normalizeProjectId } from "./projects.rbac";

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
  // Autorii/colaboratorii cursului (+ admin platformă) trebuie să vadă și să editeze
  // conținutul complet al tuturor lecțiilor, indiferent de Bariera Logică — altfel editorul
  // însuși se blochează de îndată ce o lecție are un test cu scor minim de deblocare (bug
  // găsit în sesiune: un test adăugat într-o lecție bloca accesul la lecțiile următoare chiar
  // și pentru autorul/SUPER_ADMIN-ul cursului). Bariera se aplică doar cursanților reali.
  if (await assertCourseAccess(req.params.courseId, req.user!)) {
    return res.json(lessons);
  }
  // Enforcement server-side al accesului prin Proiect (nu doar UI) — altfel conținutul
  // lecțiilor (inclusiv răspunsurile corecte din teste) ar circula spre client chiar
  // dacă pagina de curs în sine e blocată (vezi canAccessPublishedCourse).
  if (!(await canAccessPublishedCourse(req.params.courseId, req.user!))) {
    return res.status(403).json({ error: "Acces interzis — înscrie-te la un proiect care conține acest curs" });
  }
  const course = await prisma.lmsCourse.findUnique({ where: { id: req.params.courseId }, select: { requireQuizToAdvance: true } });
  const projectId = await normalizeProjectId(req.params.courseId, req.query.projectId);
  const locks = await computeLessonLocks(lessons, req.user!.id, course?.requireQuizToAdvance ?? true, projectId);
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
// lecție încă blocată. `requireQuizToAdvance=false` (setare de curs) dezactivează complet
// bariera — nicio lecție nu mai e considerată blocată, indiferent de scoruri.
// `projectId` — "" pentru un curs de sine stătător / acces direct (comportament identic cu
// dinainte de reutilizarea cursurilor între proiecte); altfel, doar tentativele de test DIN
// ACEL proiect contează pentru deblocare — un test promovat într-un proiect nu deblochează
// fals aceeași lecție reutilizată într-un proiect nou, unde cursantul n-a făcut încă nimic.
export async function computeLessonLocks(lessons: LessonRow[], userId: string, requireQuizToAdvance: boolean, projectId: string): Promise<Map<string, boolean>> {
  const locks = new Map<string, boolean>();

  if (!requireQuizToAdvance) {
    for (const lesson of lessons) locks.set(lesson.id, false);
    return locks;
  }

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
      where: { lessonId: prevLesson.id, projectId, userId },
      orderBy: { createdAt: "desc" },
    });
    locks.set(lessons[i].id, !lastAttempt || lastAttempt.score < quizBlock.requiredScoreToUnlockNext);
  }

  return locks;
}

// Condiție de emitere a certificatului (pct. 15 + cerință nouă): cursantul trebuie să fi
// promovat (scor >= prag) FIECARE test din curs care are un prag > 0 definit — indiferent
// de `requireQuizToAdvance` (acel comutator gate-uiește doar navigarea, nu certificatul).
export async function hasPassedAllQuizzes(courseId: string, userId: string, projectId: string): Promise<boolean> {
  const lessons = await prisma.lmsLesson.findMany({ where: { courseId } });
  for (const lesson of lessons) {
    const quizBlock = findQuizBlock(lesson.content);
    if (!quizBlock || quizBlock.requiredScoreToUnlockNext <= 0) continue;
    const lastAttempt = await prisma.lmsQuizAttempt.findFirst({
      where: { lessonId: lesson.id, projectId, userId },
      orderBy: { createdAt: "desc" },
    });
    if (!lastAttempt || lastAttempt.score < quizBlock.requiredScoreToUnlockNext) return false;
  }
  return true;
}

lmsLessonsRouter.get("/courses/:courseId/lessons/access", requireAuth, async (req: AuthedRequest, res) => {
  const lessons = await prisma.lmsLesson.findMany({ where: { courseId: req.params.courseId }, orderBy: { order: "asc" } });
  const course = await prisma.lmsCourse.findUnique({ where: { id: req.params.courseId }, select: { requireQuizToAdvance: true } });
  const projectId = await normalizeProjectId(req.params.courseId, req.query.projectId);
  const locks = await computeLessonLocks(lessons, req.user!.id, course?.requireQuizToAdvance ?? true, projectId);
  res.json(lessons.map((l) => ({ lessonId: l.id, locked: locks.get(l.id) ?? false })));
});
