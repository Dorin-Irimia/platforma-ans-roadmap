import { requireRole } from "../iam/rbac.middleware";

// Roluri de personal ANS care pot procesa registratura/workflow-ul (exclude
// UTILIZATOR_STANDARD — acesta reprezintă contul public/cetățean, care doar
// depune cereri prin Portal, fără acces la Back-Office).
export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUTIE",
  "MODERATOR",
  "EVALUATOR",
  "AUTOR",
  "CO_AUTOR",
] as const;

export const requireStaff = () => requireRole(...STAFF_ROLES);

// Configurarea Form Builder-ului și a definițiilor de workflow rămâne
// exclusiv administratorilor instituției.
export const requireAdmin = () => requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE");
