import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireCourseCreator, hasCourseAccess, isPlatformAdmin } from "./rbac";
import { canAccessPublishedCourse } from "./projects.rbac";

export const lmsCoursesRouter = Router();

const courseInclude = {
  lessons: { orderBy: { order: "asc" as const }, select: { id: true, title: true, order: true } },
  collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
  rubric: true,
  // Proiectul(ele) de care e deja atașat cursul — folosit la atașarea unui "curs existent"
  // într-un alt proiect, ca autorul să vadă din ce proiect provine deja fiecare curs
  // (un curs reutilizat în mai multe proiecte e același curs, nu o copie — comentariile,
  // lecțiile etc. rămân comune).
  projectLinks: { include: { project: { select: { id: true, title: true } } } },
};

// „Cursurile mele" (pct. 10) — pagina de autorat: Autor/Co-autor/CNFPA vede cursurile
// proprii (+ poate crea), Evaluator/admin platformă vede toate (pentru evaluare). NU mai
// arată catalogul public de cursuri publicate — acela se vede acum doar prin Proiecte
// (projects.routes.ts), care controlează efectiv accesul unui cursant (vezi GET /courses/:id).
//
// Important: apartenența de curs (autor/colaborator) se verifică prin rândul real din
// LmsCourseCollaborator, NU prin rolul global IAM al contului — invitarea unui utilizator
// ca Co-autor (collaboration.routes.ts) adaugă doar acel rând, nu schimbă rolul global.
// Un cont cu rol global UTILIZATOR_STANDARD/SPORTIV/etc. invitat ca Co-autor tot trebuie
// să-și vadă cursul aici, altfel rămâne complet inaccesibil din UI (bug găsit în sesiune).
lmsCoursesRouter.get("/courses", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (isPlatformAdmin(user.role) || user.role === "EVALUATOR") {
    const courses = await prisma.lmsCourse.findMany({ include: courseInclude, orderBy: { updatedAt: "desc" } });
    return res.json(courses);
  }
  const owned = await prisma.lmsCourse.findMany({
    where: { OR: [{ authorId: user.id }, { collaborators: { some: { userId: user.id } } }] },
    include: courseInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(owned);
});

const createCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

lmsCoursesRouter.post("/courses", requireAuth, requireCourseCreator(), async (req: AuthedRequest, res) => {
  const parsed = createCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.lmsCourse.create({ data: { ...parsed.data, authorId: req.user!.id } });
    await tx.lmsCourseCollaborator.create({ data: { courseId: created.id, userId: req.user!.id, courseRole: "AUTHOR" } });
    return tx.lmsCourse.findUniqueOrThrow({ where: { id: created.id }, include: courseInclude });
  });

  await logAction({ userId: req.user!.id, action: "LMS_COURSE_CREATED", resource: `lmscourse:${course.id}` });
  res.status(201).json(course);
});

lmsCoursesRouter.get("/courses/:id", requireAuth, async (req: AuthedRequest, res) => {
  const course = await prisma.lmsCourse.findUnique({ where: { id: req.params.id }, include: courseInclude });
  if (!course) return res.status(404).json({ error: "Curs inexistent" });
  if ((await hasCourseAccess(course.id, req.user!)) || req.user!.role === "EVALUATOR") return res.json(course);
  if (course.status !== "PUBLISHED") return res.status(403).json({ error: "Acces interzis" });
  if (!(await canAccessPublishedCourse(course.id, req.user!))) {
    return res.status(403).json({ error: "Acces interzis — înscrie-te la un proiect care conține acest curs" });
  }
  res.json(course);
});

// Listă de cursanți înscriși + progres — doar pt. autor/co-autor/admin platformă.
// Regulă automată: o înscriere fără progres nou de atâtea zile (LmsAssistantSettings.
// stalledAfterDays) e semnalată "stagnantă", evaluată leneș la deschiderea acestei liste.
lmsCoursesRouter.get("/courses/:id/enrollments", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const settings = await prisma.lmsAssistantSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const stalledMs = settings.stalledAfterDays * 86_400_000;
  const enrollments = await prisma.lmsEnrollment.findMany({
    where: { courseId: req.params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
  res.json(
    enrollments.map((e) => ({
      ...e,
      stalled: e.progressPercent < 100 && Date.now() - e.updatedAt.getTime() > stalledMs,
    }))
  );
});

const updateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  allowLearnerComments: z.boolean().optional(),
  requireQuizToAdvance: z.boolean().optional(),
  issueCertificate: z.boolean().optional(),
  showQuizCorrectAnswers: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
});

lmsCoursesRouter.patch("/courses/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  const parsed = updateCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const course = await prisma.lmsCourse.update({ where: { id: req.params.id }, data: parsed.data, include: courseInclude });
  await logAction({ userId: req.user!.id, action: "LMS_COURSE_UPDATED", resource: `lmscourse:${course.id}` });
  res.json(course);
});

lmsCoursesRouter.delete("/courses/:id", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsCourse.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "LMS_COURSE_DELETED", resource: `lmscourse:${req.params.id}` });
  res.json({ deleted: true });
});
