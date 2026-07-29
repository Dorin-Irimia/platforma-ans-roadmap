// Migrare unică: atribuie interacțiunile existente (progres, certificate, evaluări prin
// stele, tentative de test, comentarii de cursant) create ÎNAINTE de introducerea scoping-
// ului per-proiect — proiectul ales e cel mai vechi (createdAt) dintre proiectele la care
// cursul respectiv e deja atașat, per decizia explicită a utilizatorului ("atribui automat
// primului proiect"). Comentariile colaboratorilor/autorilor (revizuire) rămân globale
// ("" / fără proiect) — nu se ating, la fel ca orice comentariu viitor de acest fel.
// Rulare: node scripts/backfill-project-scoped-interactions.js (din containerul backend).
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const links = await prisma.lmsProjectCourse.findMany({ include: { project: { select: { id: true, createdAt: true } } } });
  const firstProjectByCourse = new Map();
  for (const link of links) {
    const existing = firstProjectByCourse.get(link.courseId);
    if (!existing || link.project.createdAt < existing.createdAt) {
      firstProjectByCourse.set(link.courseId, { id: link.project.id, createdAt: link.project.createdAt });
    }
  }

  console.log(`Cursuri atașate la cel puțin un proiect: ${firstProjectByCourse.size}`);

  for (const [courseId, project] of firstProjectByCourse) {
    const projectId = project.id;
    const lessons = await prisma.lmsLesson.findMany({ where: { courseId }, select: { id: true } });
    const lessonIds = lessons.map((l) => l.id);
    const collaboratorIds = (await prisma.lmsCourseCollaborator.findMany({ where: { courseId }, select: { userId: true } })).map((c) => c.userId);

    const enrollments = await prisma.lmsEnrollment.updateMany({ where: { courseId, projectId: "" }, data: { projectId } });
    const certificates = await prisma.lmsCertificate.updateMany({ where: { courseId, projectId: "" }, data: { projectId } });
    const feedback = await prisma.lmsFeedback.updateMany({ where: { courseId, projectId: "" }, data: { projectId } });
    const attempts = lessonIds.length
      ? await prisma.lmsQuizAttempt.updateMany({ where: { lessonId: { in: lessonIds }, projectId: "" }, data: { projectId } })
      : { count: 0 };
    // Doar comentariile cursanților reali (autor NEcolaborator) — cele de revizuire rămân globale.
    const comments = lessonIds.length
      ? await prisma.lmsComment.updateMany({
          where: { lessonId: { in: lessonIds }, projectId: "", authorId: { notIn: collaboratorIds } },
          data: { projectId },
        })
      : { count: 0 };

    console.log(
      `Curs ${courseId} -> proiect ${projectId}: ` +
        `${enrollments.count} înscrieri, ${certificates.count} certificate, ${feedback.count} evaluări, ` +
        `${attempts.count} tentative de test, ${comments.count} comentarii cursanți`
    );
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
