import { AuthPolicy } from "./api";

export function describePasswordPolicy(policy: AuthPolicy): string {
  const parts = [`minim ${policy.minPasswordLength} caractere`];
  if (policy.requireUppercase) parts.push("cel puțin o literă mare");
  if (policy.requireNumber) parts.push("cel puțin o cifră");
  return parts.join(", ") + ".";
}

export function validatePasswordAgainstPolicy(password: string, policy: AuthPolicy): string | null {
  if (password.length < policy.minPasswordLength) {
    return `Parola trebuie să aibă cel puțin ${policy.minPasswordLength} caractere`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return "Parola trebuie să conțină cel puțin o literă mare";
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return "Parola trebuie să conțină cel puțin o cifră";
  }
  return null;
}
