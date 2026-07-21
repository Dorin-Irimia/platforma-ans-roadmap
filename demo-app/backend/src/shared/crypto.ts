// Criptare simetrică pentru fișiere binare la arhivare (cerință tehnică 4.5.9) — aceeași
// schemă AES-256-GCM și cheie master ca iam/secrets.service.ts, dar Buffer-native (nu
// string/utf8, care ar corupe conținut binar precum PDF-uri). Format: iv(12) + authTag(16)
// + ciphertext, concatenate direct într-un singur Buffer (fără encodare hex intermediară).
import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function masterKey(): Buffer {
  const raw = process.env.SECRET_MANAGER_KEY || "0".repeat(64);
  return Buffer.from(raw.padEnd(64, "0").slice(0, 64), "hex");
}

export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decryptBuffer(payload: Buffer): Buffer {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, masterKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
