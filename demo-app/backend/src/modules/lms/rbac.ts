import { requireRole } from "../iam/rbac.middleware";
import { prisma } from "../../shared/prisma";
import { RoleName } from "../iam/types";

const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"] as const;

// Cine poate crea un curs nou — rolul global IAM Autor (sau administrare platformă).
// Diferit de accesul de editare pe un curs anume (vezi hasCourseAccess), care e
// scoped-per-curs prin LmsCourseCollaborator, nu global.
export const requireCourseCreator = () => requireRole(...PLATFORM_ADMIN_ROLES, "AUTOR");

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
