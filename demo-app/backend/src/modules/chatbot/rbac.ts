import { requireRole } from "../iam/rbac.middleware";

// Sistem de roluri binar cerut de caiet la Scenariul 3 (pct. 2): "cont administrator vs.
// utilizator standard". Mapăm administratorul pe rolurile de personal deja existente în
// IAM (aceleași STAFF_ROLES ca în DMS) — orice alt rol e "utilizator standard" din
// perspectiva Chatbot-ului (doar conversații + profil propriu).
export const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"] as const;

export const requireAdmin = () => requireRole(...STAFF_ROLES);
