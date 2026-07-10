// 2FA (TOTP) — folosit pentru cerința "autentificare cu doi factori (2FA)"
// din Scenariul 4. otplib generează chei compatibile Google Authenticator/Authy.
import { authenticator } from "otplib";

export function generateTwoFactorSecret(email: string) {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, "ANS Demo", secret);
  return { secret, otpauthUrl };
}

export function verifyTwoFactorToken(secret: string, token: string): boolean {
  return authenticator.check(token, secret);
}

export function generateTokenForTesting(secret: string): string {
  return authenticator.generate(secret);
}
