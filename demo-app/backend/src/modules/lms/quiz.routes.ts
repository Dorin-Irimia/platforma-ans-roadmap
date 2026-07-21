import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { computeLessonLocks } from "./lessons.routes";

export const lmsQuizRouter = Router();

const attemptSchema = z.object({ answers: z.record(z.number().int()) }); // { questionId: selectedOptionIndex }

// Scorul se calculează mereu server-side din răspunsurile corecte înglobate în
// conținutul lecției, niciodată din valori trimise direct de client (pct. 15).
lmsQuizRouter.post("/lessons/:id/quiz-attempt", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });

  // Enforcement server-side al Barierei Logice (pct. 15): o încercare pe o lecție încă
  // blocată e respinsă, indiferent de ce arată UI-ul clientului.
  const courseLessons = await prisma.lmsLesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { order: "asc" } });
  const locks = await computeLessonLocks(courseLessons, req.user!.id);
  if (locks.get(lesson.id)) return res.status(403).json({ error: "Lecția este blocată — finalizează lecția anterioară" });

  const parsed = attemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const content = Array.isArray(lesson.content) ? (lesson.content as any[]) : [];
  const quizBlock = content.find((b) => b?.type === "QUIZ");
  if (!quizBlock) return res.status(400).json({ error: "Lecția nu are un test" });

  const questions: { id: string; correctIndex: number }[] = quizBlock.questions;
  const correctCount = questions.filter((q) => parsed.data.answers[q.id] === q.correctIndex).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= (quizBlock.requiredScoreToUnlockNext ?? 0);

  const attempt = await prisma.lmsQuizAttempt.create({
    data: { userId: req.user!.id, lessonId: lesson.id, answers: parsed.data.answers, score, passed },
  });

  res.status(201).json({ ...attempt, correctCount, totalCount: questions.length });
});

lmsQuizRouter.get("/lessons/:id/quiz-attempts", requireAuth, async (req: AuthedRequest, res) => {
  const attempts = await prisma.lmsQuizAttempt.findMany({
    where: { lessonId: req.params.id, userId: req.user!.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(attempts);
});
