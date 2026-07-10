// Funcții pure de hashing/verificare parolă — separate ca să poată fi testate
// fără a avea nevoie de o conexiune la baza de date (vezi selftest.ts).
import bcrypt from "bcryptjs";
import { DEFAULT_AUTH_POLICY } from "./types";

const SALT_ROUNDS = 10;

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (password.length < DEFAULT_AUTH_POLICY.minPasswordLength) {
    return { valid: false, reason: `Parola trebuie să aibă minim ${DEFAULT_AUTH_POLICY.minPasswordLength} caractere` };
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, reason: "Parola trebuie să conțină cel puțin o literă mare și o cifră" };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
