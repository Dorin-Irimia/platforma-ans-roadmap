import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { hasCourseAccess } from "./rbac";
import { canAccessPublishedCourse, normalizeProjectId } from "./projects.rbac";
import { computeLessonLocks } from "./lessons.routes";
import { RoleName } from "../iam/types";

export const lmsFeedbackRouter = Router();

// Cine poate lăsa feedback pe un curs — un editor (autor/co-autor/admin platformă) SAU un
// cursant cu acces real la cursul publicat (prin proiect, sau curs de sine stătător).
async function hasFeedbackAccess(courseId: string, user: { id: string; role: RoleName }): Promise<boolean> {
  if (await hasCourseAccess(courseId, user)) return true;
  return canAccessPublishedCourse(courseId, user);
}

const feedbackSchema = z.object({
  scope: z.enum(["COURSE", "BLOCK"]),
  lessonId: z.string().optional(),
  blockId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
  projectId: z.string().optional(),
});

const authorSelect = { select: { id: true, name: true, email: true } } as const;

// Creează/actualizează evaluarea proprie a utilizatorului curent pentru o țintă (curs
// întreg sau un element anume dintr-o lecție) — un nou submit suprascrie evaluarea
// anterioară a aceluiași utilizator pe aceeași țintă (upsert pe cheia unică din schema).
lmsFeedbackRouter.post("/courses/:id/feedback", requireAuth, async (req: AuthedRequest, res) => {
  const course = await prisma.lmsCourse.findUnique({
    where: { id: req.params.id },
    select: { feedbackEnabled: true, requireQuizToAdvance: true },
  });
  if (!course) return res.status(404).json({ error: "Curs inexistent" });
  if (!course.feedbackEnabled) return res.status(403).json({ error: "Evaluarea nu este activată pentru acest curs" });

  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { scope, rating, comment } = parsed.data;

  if (scope === "BLOCK" && (!parsed.data.lessonId || !parsed.data.blockId)) {
    return res.status(400).json({ error: "lessonId și blockId sunt necesare pentru evaluarea unui element" });
  }

  if (!(await hasFeedbackAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });

  // "" pentru un curs de sine stătător / fără context de proiect trimis (ex. evaluarea unui
  // colaborator din editorul cursului) — altfel evaluarea e ancorată în proiectul prin care
  // cursantul a accesat cursul (nu se amestecă cu evaluări din alt proiect care reutilizează
  // același curs, vezi schema.prisma).
  const projectId = await normalizeProjectId(req.params.id, parsed.data.projectId);
  const lessonId = scope === "BLOCK" ? parsed.data.lessonId! : "";
  const blockId = scope === "BLOCK" ? parsed.data.blockId! : "";

  if (scope === "BLOCK") {
    const lesson = await prisma.lmsLesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.courseId !== req.params.id) return res.status(404).json({ error: "Lecție inexistentă" });

    // Un cursant (nu editor) poate evalua doar elemente din lecții deja deblocate — aceeași
    // regulă ca la comentariile cursanților (allowLearnerComments), ca să nu poată evalua
    // conținut pe care încă nu l-a văzut.
    const isEditor = await hasCourseAccess(req.params.id, req.user!);
    if (!isEditor) {
      const courseLessons = await prisma.lmsLesson.findMany({ where: { courseId: req.params.id }, orderBy: { order: "asc" } });
      const locks = await computeLessonLocks(courseLessons, req.user!.id, course.requireQuizToAdvance, projectId);
      if (locks.get(lessonId)) return res.status(403).json({ error: "Lecția este încă blocată" });
    }
  }

  const feedback = await prisma.lmsFeedback.upsert({
    where: { courseId_scope_lessonId_blockId_projectId_authorId: { courseId: req.params.id, scope, lessonId, blockId, projectId, authorId: req.user!.id } },
    update: { rating, comment },
    create: { courseId: req.params.id, scope, lessonId, blockId, projectId, rating, comment, authorId: req.user!.id },
  });
  res.status(201).json(feedback);
});

// Evaluarea proprie a utilizatorului curent pentru o țintă anume — folosită de widget-ul
// de stele ca să afișeze "ai evaluat deja cu N stele" în loc de un formular gol.
lmsFeedbackRouter.get("/courses/:id/feedback/mine", requireAuth, async (req: AuthedRequest, res) => {
  const scope = req.query.scope === "BLOCK" ? "BLOCK" : "COURSE";
  const lessonId = scope === "BLOCK" ? String(req.query.lessonId || "") : "";
  const blockId = scope === "BLOCK" ? String(req.query.blockId || "") : "";
  const projectId = await normalizeProjectId(req.params.id, req.query.projectId);
  const mine = await prisma.lmsFeedback.findUnique({
    where: { courseId_scope_lessonId_blockId_projectId_authorId: { courseId: req.params.id, scope, lessonId, blockId, projectId, authorId: req.user!.id } },
  });
  res.json({ rating: mine?.rating ?? null, comment: mine?.comment ?? null, updatedAt: mine?.updatedAt ?? null });
});

function distributionOf(ratings: number[]): number[] {
  const dist = [0, 0, 0, 0, 0];
  for (const r of ratings) if (r >= 1 && r <= 5) dist[r - 1]++;
  return dist;
}

function avgOf(ratings: number[]): number {
  return ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
}

// Rezumat agregat (pct. "în statistici să apară aceste date") — pentru autor/co-autor/admin.
// La nivel de curs: distribuție + comentarii. Per lecție cu elemente evaluate: aceeași
// structură, per element (bloc), cu o etichetă scurtă rezolvată din conținutul lecției.
lmsFeedbackRouter.get("/courses/:id/feedback/summary", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });

  // Rezumatul e specific unui singur proiect (cohortă) — un curs reutilizat în mai multe
  // proiecte are evaluări complet separate per proiect (vezi selectorul din Rapoarte).
  const projectId = await normalizeProjectId(req.params.id, req.query.projectId);
  const all = await prisma.lmsFeedback.findMany({
    where: { courseId: req.params.id, projectId },
    include: { author: authorSelect },
    orderBy: { createdAt: "desc" },
  });

  const courseRows = all.filter((f) => f.scope === "COURSE");
  const courseSummary = {
    count: courseRows.length,
    avg: avgOf(courseRows.map((f) => f.rating)),
    distribution: distributionOf(courseRows.map((f) => f.rating)),
    comments: courseRows.filter((f) => f.comment).map((f) => ({ id: f.id, authorName: f.author.name, rating: f.rating, comment: f.comment, createdAt: f.createdAt })),
  };

  const blockRows = all.filter((f) => f.scope === "BLOCK");
  const lessonIds = [...new Set(blockRows.map((f) => f.lessonId))];
  const lessons = await prisma.lmsLesson.findMany({ where: { id: { in: lessonIds } } });

  const lessonReports = lessons.map((lesson) => {
    const content = Array.isArray(lesson.content) ? (lesson.content as any[]) : [];
    const rowsForLesson = blockRows.filter((f) => f.lessonId === lesson.id);
    const blockIds = [...new Set(rowsForLesson.map((f) => f.blockId))];

    const blocks = blockIds.map((blockId) => {
      const block = content.find((b) => b?.id === blockId);
      const label = !block
        ? "element șters"
        : block.type === "TEXT"
          ? (block.text || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Text"
          : block.type === "IMAGE"
            ? "Imagine"
            : block.type === "VIDEO"
              ? "Video"
              : "Test";
      const rowsForBlock = rowsForLesson.filter((f) => f.blockId === blockId);
      return {
        blockId,
        label,
        count: rowsForBlock.length,
        avg: avgOf(rowsForBlock.map((f) => f.rating)),
        distribution: distributionOf(rowsForBlock.map((f) => f.rating)),
        comments: rowsForBlock.filter((f) => f.comment).map((f) => ({ id: f.id, authorName: f.author.name, rating: f.rating, comment: f.comment, createdAt: f.createdAt })),
      };
    });

    return { lessonId: lesson.id, lessonTitle: lesson.title, blocks };
  });

  res.json({ course: courseSummary, lessons: lessonReports });
});
