import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { generateCertificatePdf } from "./certificatePdf";
import { hasPassedAllQuizzes } from "./lessons.routes";
import { hasCourseAccess } from "./rbac";
import { canAccessPublishedCourse } from "./projects.rbac";

export const lmsEnrollmentRouter = Router();

// Auto-enroll la primul acces + citire progres — un singur rând per (curs, utilizator),
// folosit pentru reluarea cross-device (pct. 14).
lmsEnrollmentRouter.get("/courses/:id/enrollment", requireAuth, async (req: AuthedRequest, res) => {
  if (!(await hasCourseAccess(req.params.id, req.user!)) && !(await canAccessPublishedCourse(req.params.id, req.user!))) {
    return res.status(403).json({ error: "Acces interzis — înscrie-te la un proiect care conține acest curs" });
  }
  const enrollment = await prisma.lmsEnrollment.upsert({
    where: { courseId_userId: { courseId: req.params.id, userId: req.user!.id } },
    update: {},
    create: { courseId: req.params.id, userId: req.user!.id },
  });
  res.json(enrollment);
});

const progressSchema = z.object({
  currentLessonId: z.string().optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
});

lmsEnrollmentRouter.patch("/courses/:id/enrollment/progress", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = progressSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Citim înregistrarea existentă ÎNAINTE de upsert ca să detectăm tranziția la 100% —
  // certificatul de absolvire (cerință CNFPA 4.5.8) se emite o singură dată, la prima
  // atingere a 100%, nu la fiecare PATCH ulterior care rămâne la 100%.
  const existing = await prisma.lmsEnrollment.findUnique({
    where: { courseId_userId: { courseId: req.params.id, userId: req.user!.id } },
  });
  const wasComplete = (existing?.progressPercent ?? 0) >= 100;

  const enrollment = await prisma.lmsEnrollment.upsert({
    where: { courseId_userId: { courseId: req.params.id, userId: req.user!.id } },
    update: parsed.data,
    create: { courseId: req.params.id, userId: req.user!.id, ...parsed.data },
  });

  if (!wasComplete && enrollment.progressPercent >= 100) {
    const already = await prisma.lmsCertificate.findUnique({
      where: { courseId_userId: { courseId: req.params.id, userId: req.user!.id } },
    });
    const [course, user] = await Promise.all([
      prisma.lmsCourse.findUniqueOrThrow({ where: { id: req.params.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } }),
    ]);
    // Certificatul se emite doar dacă (a) cursul chiar are activată generarea de
    // certificate, ȘI (b) cursantul a promovat FIECARE test din curs — indiferent de
    // `requireQuizToAdvance`, care gate-uiește doar navigarea între lecții, nu certificatul.
    const eligible = course.issueCertificate && (await hasPassedAllQuizzes(req.params.id, req.user!.id));
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
        data: { courseId: req.params.id, userId: req.user!.id, certificateNumber, storagePath },
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
