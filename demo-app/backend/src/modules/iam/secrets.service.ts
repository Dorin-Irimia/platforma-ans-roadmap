// Secret Manager simplificat (cerință Scenariul 4: "gestionare centralizată și
// securizată a secretelor — chei API, certificate, credențiale de servicii").
// Criptare simetrică AES-256-GCM; cheia master vine din variabila de mediu
// SECRET_MANAGER_KEY (în producție ar veni dintr-un KMS/Vault real).
import crypto from "crypto";

const ALGO = "aes-256-gcm";

function masterKey(): Buffer {
  const raw = process.env.SECRET_MANAGER_KEY || "0".repeat(64);
  return Buffer.from(raw.padEnd(64, "0").slice(0, 64), "hex");
}

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = crypto.createDecipheriv(ALGO, masterKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}
