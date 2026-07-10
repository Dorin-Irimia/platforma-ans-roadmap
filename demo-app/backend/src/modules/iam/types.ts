export type RoleName =
  | "SUPER_ADMIN"
  | "ADMIN_INSTITUTIE"
  | "MODERATOR"
  | "EVALUATOR"
  | "AUTOR"
  | "CO_AUTOR"
  | "UTILIZATOR_STANDARD";

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: RoleName;
}

// Politici configurabile de autentificare (cerință Scenariul 4)
export interface AuthPolicy {
  sessionDurationMinutes: number;
  minPasswordLength: number;
  maxFailedAttempts: number;
  lockoutMinutes: number;
}

export const DEFAULT_AUTH_POLICY: AuthPolicy = {
  sessionDurationMinutes: 60,
  minPasswordLength: 8,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
};
