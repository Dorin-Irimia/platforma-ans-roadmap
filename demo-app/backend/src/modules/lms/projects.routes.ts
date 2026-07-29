import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireCourseCreator, hasCourseAccess } from "./rbac";
import { isProjectOwnerOrAdmin, canSeeProject, getProjectEnrollment, computeProjectCourseLocks } from "./projects.rbac";

export const lmsProjectsRouter = Router();

const projectInclude = {
  courses: { orderBy: { order: "asc" as const }, include: { course: { select: { id: true, title: true, description: true, status: true } } } },
};

async function serializeProject(project: any, userId: string) {
  const enrollment = await getProjectEnrollment(project.id, userId);
  const orderedCourseIds = project.courses.map((pc: any) => pc.courseId);
  const locks = await computeProjectCourseLocks(orderedCourseIds, userId, project.progression, project.id);
  return {
    ...project,
    myEnrollmentStatus: enrollment?.status ?? null,
    courses: project.courses.map((pc: any) => ({ ...pc, locked: locks.get(pc.courseId) ?? false })),
  };
}

// Organizator/tablou de bord (pct. 10, caiet 4.5.8) — listă de proiecte vizibile
// utilizatorului curent (vezi canSeeProject: proiectele INVITE_ONLY sunt ascunse
// complet cuiva care nu a fost deja adăugat explicit).
lmsProjectsRouter.get("/projects", requireAuth, async (req: AuthedRequest, res) => {
  const all = await prisma.lmsProject.findMany({ include: projectInclude, orderBy: { updatedAt: "desc" } });
  const visible = [];
  for (const project of all) {
    if (await canSeeProject(project, req.user!)) visible.push(await serializeProject(project, req.user!.id));
  }
  res.json(visible);
});

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  accessMode: z.enum(["OPEN", "APPROVAL", "INVITE_ONLY"]).default("OPEN"),
  progression: z.enum(["SEQUENTIAL", "FREE"]).default("FREE"),
});

lmsProjectsRouter.post("/projects", requireAuth, requireCourseCreator(), async (req: AuthedRequest, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const project = await prisma.lmsProject.create({
    data: { ...parsed.data, ownerId: req.user!.id },
    include: projectInclude,
  });
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_CREATED", resource: `lmsproject:${project.id}` });
  res.status(201).json(await serializeProject(project, req.user!.id));
});

lmsProjectsRouter.get("/projects/:id", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id }, include: projectInclude });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!(await canSeeProject(project, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  res.json(await serializeProject(project, req.user!.id));
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  accessMode: z.enum(["OPEN", "APPROVAL", "INVITE_ONLY"]).optional(),
  progression: z.enum(["SEQUENTIAL", "FREE"]).optional(),
});

lmsProjectsRouter.patch("/projects/:id", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.lmsProject.update({ where: { id: project.id }, data: parsed.data, include: projectInclude });
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_UPDATED", resource: `lmsproject:${project.id}` });
  res.json(await serializeProject(updated, req.user!.id));
});

lmsProjectsRouter.delete("/projects/:id", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsProject.delete({ where: { id: project.id } });
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_DELETED", resource: `lmsproject:${project.id}` });
  res.json({ deleted: true });
});

// Atașare curs — fie unul existent (courseId, cu drept de acces asupra lui), fie unul
// nou (title/description), creat direct din pagina proiectului și atașat pe loc.
const addCourseSchema = z.union([
  z.object({ courseId: z.string() }),
  z.object({ title: z.string().min(1), description: z.string().optional() }),
]);

lmsProjectsRouter.post("/projects/:id/courses", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id }, include: { courses: true } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  const parsed = addCourseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const body = parsed.data;

  let courseId: string;
  if ("courseId" in body) {
    const { courseId: existingCourseId } = body as { courseId: string };
    if (!(await hasCourseAccess(existingCourseId, req.user!))) return res.status(403).json({ error: "Nu ai acces la acest curs" });
    courseId = existingCourseId;
  } else {
    const { title: newCourseTitle, description: newCourseDescription } = body as { title: string; description?: string };
    const created = await prisma.$transaction(async (tx) => {
      const course = await tx.lmsCourse.create({ data: { title: newCourseTitle, description: newCourseDescription, authorId: req.user!.id } });
      await tx.lmsCourseCollaborator.create({ data: { courseId: course.id, userId: req.user!.id, courseRole: "AUTHOR" } });
      return course;
    });
    courseId = created.id;
  }

  const nextOrder = project.courses.length ? Math.max(...project.courses.map((c) => c.order)) + 1 : 0;
  await prisma.lmsProjectCourse.upsert({
    where: { projectId_courseId: { projectId: project.id, courseId } },
    update: {},
    create: { projectId: project.id, courseId, order: nextOrder },
  });
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_COURSE_ADDED", resource: `lmsproject:${project.id}`, metadata: { courseId } });

  const updated = await prisma.lmsProject.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude });
  res.status(201).json(await serializeProject(updated, req.user!.id));
});

lmsProjectsRouter.delete("/projects/:id/courses/:courseId", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsProjectCourse.delete({ where: { projectId_courseId: { projectId: project.id, courseId: req.params.courseId } } });
  res.json({ deleted: true });
});

const reorderSchema = z.object({ courseIds: z.array(z.string()) });

lmsProjectsRouter.patch("/projects/:id/courses/reorder", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await prisma.$transaction(
    parsed.data.courseIds.map((courseId, order) =>
      prisma.lmsProjectCourse.update({ where: { projectId_courseId: { projectId: project.id, courseId } }, data: { order } })
    )
  );
  const updated = await prisma.lmsProject.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude });
  res.json(await serializeProject(updated, req.user!.id));
});

// Înscriere — comportamentul depinde de accessMode: OPEN intră direct ACTIVE, APPROVAL
// devine o cerere PENDING, INVITE_ONLY nu permite deloc autoînscriere (doar owner/admin
// adaugă explicit, vezi PATCH /enrollments/:userId de mai jos).
lmsProjectsRouter.post("/projects/:id/enroll", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!(await canSeeProject(project, req.user!))) return res.status(403).json({ error: "Acces interzis" });
  if (project.accessMode === "INVITE_ONLY") {
    return res.status(403).json({ error: "Acest proiect necesită numire explicită de către un administrator" });
  }
  const status = project.accessMode === "OPEN" ? "ACTIVE" : "PENDING";
  const enrollment = await prisma.lmsProjectEnrollment.upsert({
    where: { projectId_userId: { projectId: project.id, userId: req.user!.id } },
    update: status === "ACTIVE" ? { status } : {},
    create: { projectId: project.id, userId: req.user!.id, status },
  });
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_ENROLL_REQUESTED", resource: `lmsproject:${project.id}`, metadata: { status: enrollment.status } });
  res.status(201).json(enrollment);
});

lmsProjectsRouter.get("/projects/:id/enrollments", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  const enrollments = await prisma.lmsProjectEnrollment.findMany({
    where: { projectId: project.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { requestedAt: "desc" },
  });
  res.json(enrollments);
});

const decideEnrollmentSchema = z.object({ status: z.enum(["ACTIVE", "REJECTED"]) });

// Folosită și pentru decizia unei cereri APPROVAL, și pentru numirea explicită directă
// (INVITE_ONLY) — owner/admin poate crea un rând ACTIVE pentru un utilizator care nu a
// cerut nimic încă (upsert), exact fluxul de "numire" descris de cerință.
lmsProjectsRouter.patch("/projects/:id/enrollments/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  const parsed = decideEnrollmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const enrollment = await prisma.lmsProjectEnrollment.upsert({
    where: { projectId_userId: { projectId: project.id, userId: req.params.userId } },
    update: { status: parsed.data.status, decidedAt: new Date(), decidedById: req.user!.id },
    create: { projectId: project.id, userId: req.params.userId, status: parsed.data.status, decidedAt: new Date(), decidedById: req.user!.id },
  });
  await logAction({
    userId: req.user!.id,
    action: "LMS_PROJECT_ENROLLMENT_DECIDED",
    resource: `lmsproject:${project.id}`,
    metadata: { targetUserId: req.params.userId, status: parsed.data.status },
  });
  res.json(enrollment);
});

lmsProjectsRouter.delete("/projects/:id/enrollments/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const project = await prisma.lmsProject.findUnique({ where: { id: req.params.id } });
  if (!project) return res.status(404).json({ error: "Proiect inexistent" });
  if (!isProjectOwnerOrAdmin(project, req.user!)) return res.status(403).json({ error: "Acces interzis" });
  await prisma.lmsProjectEnrollment.delete({ where: { projectId_userId: { projectId: project.id, userId: req.params.userId } } }).catch(() => {});
  await logAction({ userId: req.user!.id, action: "LMS_PROJECT_ACCESS_REVOKED", resource: `lmsproject:${project.id}`, metadata: { targetUserId: req.params.userId } });
  res.json({ revoked: true });
});
