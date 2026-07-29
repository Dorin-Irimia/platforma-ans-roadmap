import { requireRole } from "../iam/rbac.middleware";
import { prisma } from "../../shared/prisma";
import { RoleName } from "../iam/types";

const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"] as const;

// Cine poate crea un curs nou — rolul global IAM Autor (sau administrare platformă).
// Diferit de accesul de editare pe un curs anume (vezi hasCourseAccess), care e
// scoped-per-curs prin LmsCourseCollaborator, nu global.
// CNFPA (4.5.1 R18/R19, 4.5.8) primește drepturi de autor LMS — platforma CNFPA reală
// e chiar acest modul LMS existent, nu unul separat.
export const requireCourseCreator = () => requireRole(...PLATFORM_ADMIN_ROLES, "AUTOR", "CNFPA");

export async function hasCourseAccess(courseId: string, user: { id: string; role: RoleName }): Promise<boolean> {
  if ((PLATFORM_ADMIN_ROLES as readonly string[]).includes(user.role)) return true;
  const collab = await prisma.lmsCourseCollaborator.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
  });
  return !!collab;
}

export function isPlatformAdmin(role: RoleName): boolean {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

// Colaborare REALĂ pe curs — un rând efectiv în LmsCourseCollaborator, fără bypass-ul de
// rol global din hasCourseAccess. Folosit strict pentru vizibilitatea comentariilor: un
// SUPER_ADMIN/ADMIN_INSTITUTIE care parcurge un curs CA cursant (nu ca autor/co-autor real
// al lui) trebuie să-și vadă doar propriile comentarii, la fel ca orice alt cursant — rolul
// global de admin nu trebuie să-i dea acces implicit la comentariile private ale altora.
export async function isRealCourseCollaborator(courseId: string, userId: string): Promise<boolean> {
  const collab = await prisma.lmsCourseCollaborator.findUnique({
    where: { courseId_userId: { courseId, userId } },
  });
  return !!collab;
}
