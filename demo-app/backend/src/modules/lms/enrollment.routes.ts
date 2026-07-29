import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { generateCertificatePdf } from "./certificatePdf";
import { hasPassedAllQuizzes } from "./lessons.routes";
import { hasCourseAccess } from "./rbac";
import { canAccessPublishedCourse, normalizeProjectId } from "./projects.rbac";

export const lmsEnrollmentRouter = Router();

// Auto-enroll la primul acces + citire progres — un rând per (curs, proiect, utilizator):
// un curs reutilizat în mai multe proiecte capătă progres complet separat per proiect
// (vezi schema.prisma, LmsEnrollment.projectId) — folosit pentru reluarea cross-device
// (pct. 14), dar scoping-ul pe proiect are prioritate față de acel comportament.
lmsEnrollmentRouter.get("/courses/:id/enrollment", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!)) && !(await canAccessPublishedCourse(req.params.id, req.user!))) {
    return res.status(403).json({ error: "Acces interzis — înscrie-te la un proiect care conține acest curs" });
  }
  const projectId = await normalizeProjectId(req.params.id, req.query.projectId);
  const enrollment = await prisma.lmsEnrollment.upsert({
    where: { courseId_projectId_userId: { courseId: req.params.id, projectId, userId: req.user!.id } },
    update: {},
    create: { courseId: req.params.id, projectId, userId: req.user!.id },
  });
  res.json(enrollment);
});

// Panoul principal — "Continuă parcurgerea" (reluare ultima lecție + lecții recente,
// finalizate/în curs) — spre diferență de rutele de mai sus (per-curs), asta e o listă
// peste TOATE înscrierile utilizatorului curent. `currentLessonId` nu are relație Prisma
// declarată (câmp plat), deci titlul lecției se rezolvă separat, cu un lookup batch.
lmsEnrollmentRouter.get("/my-enrollments", requireAuth, async (req: AuthedRequest, res) => {
  const enrollments = await prisma.lmsEnrollment.findMany({
    where: { userId: req.user!.id },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const lessonIds = enrollments.map((e) => e.currentLessonId).filter((x): x is string => !!x);
  const lessons = lessonIds.length
    ? await prisma.lmsLesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } })
    : [];
  const lessonTitleById = new Map(lessons.map((l) => [l.id, l.title]));

  res.json(
    enrollments.map((e) => ({
      id: e.id,
      courseId: e.courseId,
      course: e.course,
      currentLessonId: e.currentLessonId,
      currentLessonTitle: e.currentLessonId ? lessonTitleById.get(e.currentLessonId) ?? null : null,
      progressPercent: e.progressPercent,
      updatedAt: e.updatedAt,
      // Rând real acum (nu mai e o ghicire best-effort) — LmsEnrollment.projectId chiar
      // reflectă proiectul prin care s-a făcut progresul acesta, vezi schema.prisma.
      projectId: e.projectId || null,
    }))
  );
});

const progressSchema = z.object({
  currentLessonId: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  projectId: z.string().optional(),
});

lmsEnrollmentRouter.patch("/courses/:id/enrollment/progress", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const projectId = await normalizeProjectId(req.params.id, parsed.data.projectId);
  const { projectId: _omit, ...progressData } = parsed.data;

  const enrollment = await prisma.lmsEnrollment.upsert({
    where: { courseId_projectId_userId: { courseId: req.params.id, projectId, userId: req.user!.id } },
    update: progressData,
    create: { courseId: req.params.id, projectId, userId: req.user!.id, ...progressData },
  });

  // Bug real, reprodus: progresul ajunge la 100% prin simpla NAVIGARE la ultima lecție
  // (goToLesson), nu la promovarea testului ei — un cursant ajunge des la 100% ÎNAINTE
  // să fi trecut testul ultimei lecții. Dacă verificarea de eligibilitate ar rula o
  // SINGURĂ dată, doar la acea tranziție 0→100% (cum era înainte), ea ar eșua în acel
  // moment (testul ultimei lecții încă nepromovat) și nu s-ar mai reevalua NICIODATĂ —
  // inclusiv la click-ul explicit pe "Finalizează cursul", DUPĂ ce testul chiar a fost
  // promovat, pentru că progresul era deja 100% dinainte. `already` (mai jos) previne
  // deja duplicarea unui certificat existent, deci verificăm eligibilitatea la FIECARE
  // actualizare care citește 100%, nu doar la prima tranziție.
  if (enrollment.progressPercent >= 100) {
    const already = await prisma.lmsCertificate.findUnique({
      where: { courseId_projectId_userId: { courseId: req.params.id, projectId, userId: req.user!.id } },
    });
    const [course, user] = await Promise.all([
      prisma.lmsCourse.findUniqueOrThrow({ where: { id: req.params.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }),
    ]);
    // Certificatul se emite doar dacă (a) cursul chiar are activată generarea de
    // certificate, ȘI (b) cursantul a promovat FIECARE test din curs — indiferent de
    // `requireQuizToAdvance`, care gate-uiește doar navigarea între lecții, nu certificatul.
    const eligible = course.issueCertificate && (await hasPassedAllQuizzes(req.params.id, req.user!.id, projectId));
    if (!already && eligible) {
      const year = new Date().getFullYear();
      const countThisYear = await prisma.lmsCertificate.count({ where: { issuedAt: { gte: new Date(`${year}-01-01`) } } });
      const certificateNumber = `CERT-${year}-${String(countThisYear + 1).padStart(4, "0")}`;
      const issuedAtLabel = new Date().toLocaleDateString("ro-RO");

      const pdfBuffer = await generateCertificatePdf({
        certificateNumber,
        studentName: user.name || user.email,
        courseTitle: course.title,
        issuedAt: issuedAtLabel,
      });
      const storagePath = newStoragePath("lms-certificates", ".pdf");
      writeFile(storagePath, pdfBuffer);

      await prisma.lmsCertificate.create({
        data: { courseId: req.params.id, projectId, userId: req.user!.id, certificateNumber, storagePath },
      });
    }
  }

  res.json(enrollment);
});

lmsEnrollmentRouter.get("/certificates", requireAuth, async (req: AuthedRequest, res) => {
  const certificates = await prisma.lmsCertificate.findMany({
    where: { userId: req.user!.id },
    include: { course: { select: { id: true, title: true } } },
    orderBy: { issuedAt: "desc" },
  });
  res.json(certificates);
});

lmsEnrollmentRouter.get("/certificates/:id/file", requireAuth, async (req: AuthedRequest, res) => {
  const certificate = await prisma.lmsCertificate.findUnique({ where: { id: req.params.id } });
  if (!certificate || certificate.userId !== req.user!.id) return res.status(404).json({ error: "Certificat inexistent" });
  const buffer = readFile(certificate.storagePath);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${certificate.certificateNumber}.pdf"`);
  res.send(buffer);
});
