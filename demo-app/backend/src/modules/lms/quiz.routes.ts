import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { computeLessonLocks } from "./lessons.routes";
import { hasCourseAccess } from "./rbac";
import { normalizeProjectId } from "./projects.rbac";

export const lmsQuizRouter = Router();

const attemptSchema = z.object({ answers: z.record(z.array(z.number().int())), projectId: z.string().optional() }); // { questionId: selectedOptionIndexes }

interface QuizQuestionRow {
  id: string;
  text: string;
  options: string[];
  correctIndexes?: number[];
  correctIndex?: number; // întrebări vechi, dinainte de "răspunsuri multiple corecte"
}

// Set de indexuri corecte, cu fallback retro-compatibil pentru întrebările vechi
// salvate doar cu `correctIndex` (un singur index) — vezi `correctIndexesOf` pe frontend.
function correctIndexesOf(q: QuizQuestionRow): number[] {
  if (q.correctIndexes) return q.correctIndexes;
  if (typeof q.correctIndex === "number") return [q.correctIndex];
  return [];
}

// Fără punctaj parțial — setul bifat trebuie să coincidă EXACT cu setul de răspunsuri corecte.
function isExactMatch(selected: number[], correct: number[]): boolean {
  if (selected.length !== correct.length) return false;
  const correctSet = new Set(correct);
  return selected.every((i) => correctSet.has(i));
}

// Scorul se calculează mereu server-side din răspunsurile corecte înglobate în
// conținutul lecției, niciodată din valori trimise direct de client (pct. 15).
lmsQuizRouter.post("/lessons/:id/quiz-attempt", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });

  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // "" pentru un curs de sine stătător / acces direct — altfel doar tentativele DIN ACEL
  // proiect contează, ca un test promovat într-un proiect să nu deblocheze fals aceeași
  // lecție reutilizată într-un proiect nou (vezi computeLessonLocks).
  const projectId = await normalizeProjectId(lesson.courseId, parsed.data.projectId);

  // Enforcement server-side al Barierei Logice (pct. 15): o încercare pe o lecție încă
  // blocată e respinsă, indiferent de ce arată UI-ul clientului.
  const courseLessons = await prisma.lmsLesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { order: "asc" } });
  const course = await prisma.lmsCourse.findUnique({ where: { id: lesson.courseId }, select: { requireQuizToAdvance: true } });
  const locks = await computeLessonLocks(courseLessons, req.user!.id, course?.requireQuizToAdvance ?? true, projectId);
  if (locks.get(lesson.id)) return res.status(403).json({ error: "Lecția este blocată — finalizează lecția anterioară" });

  const content = Array.isArray(lesson.content) ? (lesson.content as any[]) : [];
  const quizBlock = content.find((b) => b?.type === "QUIZ");
  if (!quizBlock) return res.status(400).json({ error: "Lecția nu are un test" });

  const questions: QuizQuestionRow[] = quizBlock.questions;
  const correctCount = questions.filter((q) => isExactMatch(parsed.data.answers[q.id] || [], correctIndexesOf(q))).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= (quizBlock.requiredScoreToUnlockNext ?? 0);

  const attempt = await prisma.lmsQuizAttempt.create({
    data: { userId: req.user!.id, lessonId: lesson.id, projectId, answers: parsed.data.answers, score, passed },
  });

  res.status(201).json({ ...attempt, correctCount, totalCount: questions.length });
});

lmsQuizRouter.get("/lessons/:id/quiz-attempts", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  const projectId = await normalizeProjectId(lesson.courseId, req.query.projectId);
  const attempts = await prisma.lmsQuizAttempt.findMany({
    where: { lessonId: req.params.id, projectId, userId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(attempts);
});

// Raport de răspunsuri per curs (pentru autor/co-autor/admin) — agregă, pentru fiecare
// lecție cu test, DOAR ultima încercare a fiecărui cursant (aceeași regulă ca la Bariera
// Logică din computeLessonLocks), cu distribuția opțiunilor alese per întrebare.
lmsQuizRouter.get("/courses/:id/quiz-report", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });

  // Raportul e specific unui singur proiect (cohortă) — un curs reutilizat în mai multe
  // proiecte are statistici complet separate per proiect (vezi selectorul din Rapoarte).
  const projectId = await normalizeProjectId(req.params.id, req.query.projectId);
  const lessons = await prisma.lmsLesson.findMany({ where: { courseId: req.params.id }, orderBy: { order: "asc" } });
  const report = [];

  for (const lesson of lessons) {
    const content = Array.isArray(lesson.content) ? (lesson.content as any[]) : [];
    const quizBlock = content.find((b) => b?.type === "QUIZ");
    if (!quizBlock) continue;

    const attempts = await prisma.lmsQuizAttempt.findMany({ where: { lessonId: lesson.id, projectId }, orderBy: { createdAt: "desc" } });
    // Ultima încercare per cursant — un cursant poate reîncerca de mai multe ori.
    const lastByUser = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) if (!lastByUser.has(a.userId)) lastByUser.set(a.userId, a);
    const latestAttempts = [...lastByUser.values()];

    const questions: QuizQuestionRow[] = quizBlock.questions;
    const questionReports = questions.map((q) => {
      const optionCounts = q.options.map(() => 0);
      let correctCount = 0;
      let answeredCount = 0;
      for (const attempt of latestAttempts) {
        const answers = (attempt.answers as Record<string, number[]>) || {};
        const selected = answers[q.id];
        if (!selected) continue;
        answeredCount++;
        selected.forEach((oi) => { if (optionCounts[oi] !== undefined) optionCounts[oi]++; });
        if (isExactMatch(selected, correctIndexesOf(q))) correctCount++;
      }
      return {
        questionId: q.id,
        text: q.text,
        options: q.options,
        correctIndexes: correctIndexesOf(q),
        optionCounts,
        answeredCount,
        correctRate: answeredCount ? Math.round((correctCount / answeredCount) * 100) : 0,
      };
    });

    const passedCount = latestAttempts.filter((a) => a.passed).length;
    const avgScore = latestAttempts.length ? Math.round(latestAttempts.reduce((sum, a) => sum + a.score, 0) / latestAttempts.length) : 0;

    report.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      requiredScoreToUnlockNext: quizBlock.requiredScoreToUnlockNext ?? 0,
      attemptedCount: latestAttempts.length,
      passedCount,
      passRate: latestAttempts.length ? Math.round((passedCount / latestAttempts.length) * 100) : 0,
      avgScore,
      questions: questionReports,
    });
  }

  res.json(report);
});
