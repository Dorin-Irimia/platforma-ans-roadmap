import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireCourseCreator, hasCourseAccess, isPlatformAdmin } from "./rbac";

export const lmsCoursesRouter = Router();

const courseInclude = {
  lessons: { orderBy: { order: "asc" as const }, select: { id: true, title: true, order: true } },
  collaborators: { include: { user: { select: { id: true, name: true, email: true } } } },
  rubric: true,
};

// Organizator/tablou de bord (pct. 10) — listă diferențiată pe rol: Autor/Co-autor vede
// cursurile proprii (+ poate crea), Evaluator vede toate (pentru evaluare), Cursantul
// vede doar catalogul publicat.
lmsCoursesRouter.get("/courses", requireAuth, async (req: AuthedRequest, res) => {
  const user = req.user!;
  if (isPlatformAdmin(user.role) || user.role === "EVALUATOR") {
    const courses = await prisma.lmsCourse.findMany({ include: courseInclude, orderBy: { updatedAt: "desc" } });
    return res.json(courses);
  }
  if (user.role === "AUTOR" || user.role === "CO_AUTOR") {
    const courses = await prisma.lmsCourse.findMany({
      where: { OR: [{ authorId: user.id }, { collaborators: { some: { userId: user.id } } }] },
      include: courseInclude,
      orderBy: { updatedAt: "desc" },
    });
    return res.json(courses);
  }
  const courses = await prisma.lmsCourse.findMany({
    where: { status: "PUBLISHED" },
    include: courseInclude,
    orderBy: { updatedAt: "desc" },
  });
  res.json(courses);
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
  if (course.status !== "PUBLISHED" && !(await hasCourseAccess(course.id, req.user!)) && req.user!.role !== "EVALUATOR") {
    return res.status(403).json({ error: "Acces interzis" });
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
