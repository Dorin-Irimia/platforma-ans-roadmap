import { prisma } from "../../shared/prisma";

export interface AuthPolicy {
  sessionMinutes: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  pendingApprovalExpiryDays: number;
}

const DEFAULTS: Omit<AuthPolicy, never> = {
  sessionMinutes: 60,
  minPasswordLength: 8,
  requireUppercase: true,
  requireNumber: true,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  pendingApprovalExpiryDays: 14,
};

// Rând singleton — se creează cu valori implicite la prima citire dacă nu există încă.
export async function getAuthPolicy(): Promise<AuthPolicy> {
  const row = await prisma.authPolicySettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton", ...DEFAULTS },
  });
  const { id, updatedAt, ...policy } = row;
  return policy;
}

export function validatePassword(password: string, policy: AuthPolicy): { valid: boolean; reason?: string } {
  if (password.length < policy.minPasswordLength) {
    return { valid: false, reason: `Parola trebuie să aibă cel puțin ${policy.minPasswordLength} caractere` };
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, reason: "Parola trebuie să conțină cel puțin o literă mare" };
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, reason: "Parola trebuie să conțină cel puțin o cifră" };
  }
  return { valid: true };
}
