// Self-test fără bază de date — validează logica pură a modulului IAM rămasă local
// (criptare secrete; parola/JWT/2FA sunt acum gestionate de Supabase Auth). Rulează cu: npm run test:iam
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
  // Secret manager (encrypt/decrypt roundtrip)
  const encrypted = encryptSecret("api-key-super-secreta");
  assert(encrypted !== "api-key-super-secreta", "secretul e criptat, nu stocat în clar");
  assert(decryptSecret(encrypted) === "api-key-super-secreta", "decriptare secret roundtrip corect");

  console.log(`\n${failures === 0 ? "TOATE TESTELE AU TRECUT" : failures + " TESTE EȘUATE"}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
