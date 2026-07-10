// Self-test fără bază de date — validează logica pură a modulului IAM
// (hashing parolă, JWT, TOTP, criptare secrete). Rulează cu: npm run test:iam
import { hashPassword, verifyPassword, validatePasswordStrength } from "./password";
import { generateTwoFactorSecret, verifyTwoFactorToken, generateTokenForTesting } from "./totp";
import { signToken, verifyToken } from "./jwt";
import { encryptSecret, decryptSecret } from "./secrets.service";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`OK   - ${label}`);
  } else {
    console.error(`FAIL - ${label}`);
    failures++;
  }
}

async function main() {
  // Password policy
  assert(!validatePasswordStrength("scurt").valid, "parolă prea scurtă e respinsă");
  assert(validatePasswordStrength("Parola123").valid, "parolă validă e acceptată");

  // Hashing
  const hash = await hashPassword("Parola123");
  assert(hash !== "Parola123", "parola e hash-uită, nu stocată în clar");
  assert(await verifyPassword("Parola123", hash), "verificare parolă corectă reușește");
  assert(!(await verifyPassword("altaParola", hash)), "verificare parolă greșită eșuează");

  // JWT
  const token = signToken({ sub: "u1", email: "test@ans.ro", role: "ADMIN_INSTITUTIE" });
  const decoded = verifyToken(token);
  assert(decoded.email === "test@ans.ro" && decoded.role === "ADMIN_INSTITUTIE", "JWT sign/verify roundtrip");

  // 2FA (TOTP)
  const { secret } = generateTwoFactorSecret("test@ans.ro");
  const validToken = generateTokenForTesting(secret);
  assert(verifyTwoFactorToken(secret, validToken), "cod TOTP valid e acceptat");
  assert(!verifyTwoFactorToken(secret, "000000"), "cod TOTP greșit e respins (probabilistic)");

  // Secret manager (encrypt/decrypt roundtrip)
  const encrypted = encryptSecret("api-key-super-secreta");
  assert(encrypted !== "api-key-super-secreta", "secretul e criptat, nu stocat în clar");
  assert(decryptSecret(encrypted) === "api-key-super-secreta", "decriptare secret roundtrip corect");

  console.log(`\n${failures === 0 ? "TOATE TESTELE AU TRECUT" : failures + " TESTE EȘUATE"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
