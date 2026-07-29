import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { hasCourseAccess, isRealCourseCollaborator } from "./rbac";
import { computeLessonLocks } from "./lessons.routes";
import { normalizeProjectId } from "./projects.rbac";

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

// Panou de revizuire — comentarii contextuale pe bloc + rezolvare (pct. 12). `quote` e
// fragmentul exact selectat (text sau enunțul unei întrebări) — comentariu "ca la Word",
// ancorat la o secvență precisă, nu doar la tot blocul.
const commentSchema = z.object({ blockId: z.string(), body: z.string().min(1), quote: z.string().optional(), projectId: z.string().optional() });
const authorSelect = { select: { id: true, name: true, email: true } } as const;

lmsCollaborationRouter.get("/lessons/:id/comments", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  // Colaborare REALĂ, nu hasCourseAccess — altfel orice SUPER_ADMIN/ADMIN_INSTITUTIE care
  // parcurge cursul ca cursant (fără să fie autor/co-autor real) ar vedea automat toate
  // comentariile private ale celorlalți, doar în virtutea rolului global de platformă.
  const isEditor = await isRealCourseCollaborator(lesson.courseId, req.user!.id);
  // Comentariile sunt vizibile integral doar colaboratorilor/autorilor cursului — un
  // cursant obișnuit își vede DOAR propriile comentarii (+ răspunsurile primite la ele),
  // niciodată comentariile altor cursanți. Un editor vede TOATE comentariile de revizuire,
  // indiferent de proiect (acelea sunt globale — vezi schema.prisma, LmsComment.projectId);
  // un cursant vede doar comentariile din contextul proiectului prin care a accesat cursul.
  //
  // Doar comentariile de nivel superior — răspunsurile (parentId setat) vin înlănțuite
  // sub fiecare comentariu-părinte, ca un fir de discuție (ca la Word).
  const projectId = isEditor ? undefined : await normalizeProjectId(lesson.courseId, req.query.projectId);
  const comments = await prisma.lmsComment.findMany({
    where: { lessonId: req.params.id, parentId: null, ...(isEditor ? {} : { authorId: req.user!.id, projectId }) },
    include: {
      author: authorSelect,
      replies: { include: { author: authorSelect }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(comments);
});

lmsCollaborationRouter.post("/lessons/:id/comments", requireAuth, async (req: AuthedRequest, res) => {
  const lesson = await prisma.lmsLesson.findUnique({ where: { id: req.params.id } });
  if (!lesson) return res.status(404).json({ error: "Lecție inexistentă" });
  const isEditor = await hasCourseAccess(lesson.courseId, req.user!);
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // Comentariile de revizuire ale colaboratorilor/autorilor rămân globale (fără proiect) —
  // doar un cursant real ancorează comentariul în proiectul prin care a accesat cursul.
  const projectId = isEditor ? "" : await normalizeProjectId(lesson.courseId, parsed.data.projectId);
  if (!isEditor) {
    // Cursant: comentariile trebuie permise explicit de curs ("allowLearnerComments"),
    // iar lecția trebuie să fie deja deblocată pentru el ("în momentul în care au
    // deblocat o lecție" — nu poate comenta pe o lecție încă blocată).
    const course = await prisma.lmsCourse.findUnique({
      where: { id: lesson.courseId },
      select: { allowLearnerComments: true, requireQuizToAdvance: true },
    });
    if (!course?.allowLearnerComments) return res.status(403).json({ error: "Comentariile nu sunt permise cursanților la acest curs" });
    const courseLessons = await prisma.lmsLesson.findMany({ where: { courseId: lesson.courseId }, orderBy: { order: "asc" } });
    const locks = await computeLessonLocks(courseLessons, req.user!.id, course.requireQuizToAdvance, projectId);
    if (locks.get(lesson.id)) return res.status(403).json({ error: "Lecția este încă blocată" });
  }
  const comment = await prisma.lmsComment.create({
    data: { lessonId: lesson.id, blockId: parsed.data.blockId, body: parsed.data.body, quote: parsed.data.quote, projectId, authorId: req.user!.id },
    include: { author: authorSelect, replies: { include: { author: authorSelect } } },
  });
  res.status(201).json(comment);
});

const replySchema = z.object({ body: z.string().min(1) });

// Răspuns la un comentariu existent (fir de discuție) — moștenește lessonId/blockId/quote
// de la comentariul-părinte, ca să rămână ancorat în același loc din lecție.
lmsCollaborationRouter.post("/comments/:id/replies", requireAuth, async (req: AuthedRequest, res) => {
  const parent = await prisma.lmsComment.findUnique({ where: { id: req.params.id }, include: { lesson: true } });
  if (!parent) return res.status(404).json({ error: "Comentariu inexistent" });
  if (!(await hasCourseAccess(parent.lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const reply = await prisma.lmsComment.create({
    data: {
      lessonId: parent.lessonId,
      blockId: parent.blockId,
      quote: parent.quote,
      projectId: parent.projectId,
      parentId: parent.id,
      body: parsed.data.body,
      authorId: req.user!.id,
    },
    include: { author: authorSelect },
  });
  res.status(201).json(reply);
});

const statusSchema = z.object({ status: z.enum(["OPEN", "RESOLVED", "REJECTED"]) });

lmsCollaborationRouter.patch("/comments/:id/status", requireAuth, async (req: AuthedRequest, res) => {
  const comment = await prisma.lmsComment.findUnique({ where: { id: req.params.id }, include: { lesson: true } });
  if (!comment) return res.status(404).json({ error: "Comentariu inexistent" });
  if (!(await hasCourseAccess(comment.lesson.courseId, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.lmsComment.update({
    where: { id: comment.id },
    data: { status: parsed.data.status },
    include: { author: authorSelect, replies: { include: { author: authorSelect } } },
  });
  res.json(updated);
});

// Ștergere comentariu — Super Admin poate șterge orice comentariu (curățare generală).
// Un utilizator obișnuit își poate șterge DOAR propriile comentarii, și doar dacă firul
// încă nu a fost "preluat" de un administrator/colaborator (adică e Deschis și nimeni nu
// a răspuns încă — ștergerea nu distruge nimic) SAU dacă firul a fost deja finalizat
// (Rezolvat/Respins — discuția s-a încheiat, deci nu mai contează). Un comentariu Deschis
// care a primit deja un răspuns rămâne needitabil de autorul lui — l-ar șterge împreună cu
// răspunsul primit, via cascade pe schema.
lmsCollaborationRouter.delete("/comments/:id", requireAuth, async (req: AuthedRequest, res) => {
  const comment = await prisma.lmsComment.findUnique({ where: { id: req.params.id }, include: { replies: true } });
  if (!comment) return res.status(404).json({ error: "Comentariu inexistent" });

  const isSuperAdmin = req.user!.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    if (comment.authorId !== req.user!.id) return res.status(403).json({ error: "Poți șterge doar propriile comentarii" });
    const claimedByAdmin = comment.status === "OPEN" && comment.replies.length > 0;
    if (claimedByAdmin) {
      return res.status(403).json({ error: "Nu poți șterge un comentariu deschis la care s-a răspuns deja — așteaptă să fie rezolvat" });
    }
  }

  await prisma.lmsComment.delete({ where: { id: comment.id } });
  await logAction({
    userId: req.user!.id,
    action: "LMS_COMMENT_DELETED",
    resource: `lmscomment:${comment.id}`,
    metadata: { lessonId: comment.lessonId, authorId: comment.authorId, selfDelete: !isSuperAdmin },
  });
  res.json({ deleted: true });
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
