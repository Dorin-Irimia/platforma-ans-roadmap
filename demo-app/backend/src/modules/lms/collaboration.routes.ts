import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { hasCourseAccess } from "./rbac";

export const lmsCollaborationRouter = Router();

// Invitare Co-autor (pct. 12).
const inviteSchema = z.object({ userId: z.string(), courseRole: z.enum(["AUTHOR", "COAUTHOR"]).default("COAUTHOR") });

lmsCollaborationRouter.post("/courses/:id/collaborators", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const collaborator = await prisma.lmsCourseCollaborator.upsert({
    where: { courseId_userId: { courseId: req.params.id, userId: parsed.data.userId } },
    update: { courseRole: parsed.data.courseRole },
    create: { courseId: req.params.id, userId: parsed.data.userId, courseRole: parsed.data.courseRole },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  await logAction({ userId: req.user!.id, action: "LMS_COLLABORATOR_ADDED", resource: `lmscourse:${req.params.id}`, metadata: { userId: parsed.data.userId } });
  res.status(201).json(collaborator);
});

lmsCollaborationRouter.delete("/courses/:id/collaborators/:userId", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsCourseCollaborator.delete({ where: { courseId_userId: { courseId: req.params.id, userId: req.params.userId } } });
  res.json({ deleted: true });
});

// Panou de revizuire — comentarii contextuale pe bloc + rezolvare (pct. 12).
const commentSchema = z.object({ blockId: z.string(), body: z.string().min(1) });

lmsCollaborationRouter.get("/lessons/:id/comments", requireAuth, async (req, res) => {
  const comments = await prisma.lmsComment.findMany({ where: { lessonId: req.params.id }, orderBy: { createdAt: "asc" } });
  res.json(comments);
});

lmsCollaborationRouter.post("/lessons/:id/comments", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  if (!(await hasCourseAccess(lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const comment = await prisma.lmsComment.create({
    data: { lessonId: lesson.id, blockId: parsed.data.blockId, body: parsed.data.body, authorId: req.user!.id },
  });
  res.status(201).json(comment);
});

lmsCollaborationRouter.patch("/comments/:id/resolve", requireAuth, async (req: AuthedRequest, res) => {
  const comment = await prisma.lmsComment.findUnique({ where: { id: req.params.id }, include: { lesson: true } });
  if (!comment) return res.status(404).json({ error: "Comentariu inexistent" });
  if (!(await hasCourseAccess(comment.lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const updated = await prisma.lmsComment.update({ where: { id: comment.id }, data: { resolved: true } });
  res.json(updated);
});

// Rubrică de evaluare — criterii + scor structurat (pct. 12).
const rubricSchema = z.object({ criteria: z.array(z.object({ label: z.string().min(1), maxScore: z.number().int().min(1) })) });

lmsCollaborationRouter.get("/courses/:id/rubric", requireAuth, async (req, res) => {
  const rubric = await prisma.lmsRubric.findUnique({ where: { courseId: req.params.id } });
  res.json(rubric);
});

lmsCollaborationRouter.put("/courses/:id/rubric", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = rubricSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rubric = await prisma.lmsRubric.upsert({
    where: { courseId: req.params.id },
    update: { criteria: parsed.data.criteria },
    create: { courseId: req.params.id, criteria: parsed.data.criteria },
  });
  res.json(rubric);
});

const rubricScoreSchema = z.object({ scores: z.array(z.object({ label: z.string(), score: z.number() })) });

lmsCollaborationRouter.post("/lessons/:id/rubric-score", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = rubricScoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const score = await prisma.lmsRubricScore.create({
    data: { lessonId: req.params.id, evaluatorId: req.user!.id, scores: parsed.data.scores },
  });
  res.status(201).json(score);
});

lmsCollaborationRouter.get("/lessons/:id/rubric-scores", requireAuth, async (req, res) => {
  const scores = await prisma.lmsRubricScore.findMany({ where: { lessonId: req.params.id }, orderBy: { createdAt: "desc" } });
  res.json(scores);
});
