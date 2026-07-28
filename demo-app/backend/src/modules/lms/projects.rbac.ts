import { prisma } from "../../shared/prisma";
import { RoleName } from "../iam/types";
import { isPlatformAdmin } from "./rbac";

interface ProjectRow {
  id: string;
  ownerId: string;
  accessMode: string;
  progression: string;
}

export function isProjectOwnerOrAdmin(project: ProjectRow, user: { id: string; role: RoleName }): boolean {
  return project.ownerId === user.id || isPlatformAdmin(user.role);
}

export async function getProjectEnrollment(projectId: string, userId: string) {
  return prisma.lmsProjectEnrollment.findUnique({ where: { projectId_userId: { projectId, userId } } });
}

// Accesul la CURSURILE proiectului (nu doar la vizualizarea lui) — owner/admin platformă
// îl au implicit, restul doar dacă înscrierea e ACTIVE (aprobată sau autoînscriere OPEN).
export async function hasProjectAccess(project: ProjectRow, user: { id: string; role: RoleName }): Promise<boolean> {
  if (isProjectOwnerOrAdmin(project, user)) return true;
  const enrollment = await getProjectEnrollment(project.id, user.id);
  return enrollment?.status === "ACTIVE";
}

// Vizibilitatea proiectului în catalog — distinctă de accesul la cursuri: un proiect
// OPEN/APPROVAL e vizibil oricui (ca să poată cere/primi acces), dar unul INVITE_ONLY
// e ascuns complet cuiva care nu a fost deja adăugat explicit (orice status, inclusiv
// REJECTED — altfel un utilizator respins ar putea "redescoperi" proiectul din nimic).
export async function canSeeProject(project: ProjectRow, user: { id: string; role: RoleName }): Promise<boolean> {
  if (isProjectOwnerOrAdmin(project, user)) return true;
  if (project.accessMode !== "INVITE_ONLY") return true;
  const enrollment = await getProjectEnrollment(project.id, user.id);
  return !!enrollment;
}

// Analog cu computeLessonLocks (lessons.routes.ts), dar la nivel de curs-în-proiect —
// reutilizează semnalul de progres deja existent (LmsEnrollment.progressPercent), fără
// niciun model nou de "cursul X e complet".
export async function computeProjectCourseLocks(
  orderedCourseIds: string[],
  userId: string,
  progression: string
): Promise<Map<string, boolean>> {
  const locks = new Map<string, boolean>();
  if (progression !== "SEQUENTIAL") {
    for (const courseId of orderedCourseIds) locks.set(courseId, false);
    return locks;
  }
  for (let i = 0; i < orderedCourseIds.length; i++) {
    if (i === 0) {
      locks.set(orderedCourseIds[i], false);
      continue;
    }
    const prevCourseId = orderedCourseIds[i - 1];
    const prevEnrollment = await prisma.lmsEnrollment.findUnique({
      where: { courseId_userId: { courseId: prevCourseId, userId } },
    });
    locks.set(orderedCourseIds[i], (prevEnrollment?.progressPercent ?? 0) < 100);
  }
  return locks;
}

// Punct unic de decizie "poate acest CURSANT (non-editor) să acceseze conținutul acestui
// curs publicat" — folosit din courses.routes.ts (detaliu curs), lessons.routes.ts (listă
// lecții) și enrollment.routes.ts (auto-înscriere), ca să nu se dubleze/diverge logica de
// acces prin proiect în mai multe fișiere. Nu verifică hasCourseAccess (editor) — apelantul
// trebuie să facă acel bypass separat, înaintea acestui apel.
export async function canAccessPublishedCourse(courseId: string, user: { id: string; role: RoleName }): Promise<boolean> {
  const projectLinks = await prisma.lmsProjectCourse.findMany({
    where: { courseId },
    include: { project: { include: { courses: { orderBy: { order: "asc" } } } } },
  });
  // Curs de sine stătător (fără nicio legătură de proiect) — acces liber, ca înainte de
  // introducerea Proiectelor.
  if (projectLinks.length === 0) return true;

  for (const link of projectLinks) {
    if (!(await hasProjectAccess(link.project, user))) continue;
    const orderedCourseIds = link.project.courses.map((c) => c.courseId);
    const locks = await computeProjectCourseLocks(orderedCourseIds, user.id, link.project.progression);
    if (!locks.get(courseId)) return true;
  }
  return false;
}
