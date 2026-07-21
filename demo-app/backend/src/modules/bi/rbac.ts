import { requireRole } from "../iam/rbac.middleware";

// Aceleași roluri de personal ANS ca la modulul DMS — orice cont intern poate vedea
// dashboard-urile analitice și rula interogări NL2SQL; contul public (UTILIZATOR_STANDARD)
// nu are acces la panoul de Business Intelligence.
export const STAFF_ROLES = [
  "SUPER_ADMIN",
  "ADMIN_INSTITUTIE",
  "MODERATOR",
  "EVALUATOR",
  "AUTOR",
  "CO_AUTOR",
] as const;

export const requireStaff = () => requireRole(...STAFF_ROLES);
