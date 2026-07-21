// Stocare fișiere pe disc (volum Docker persistent) — echivalentul simplificat al
// "depozitului centralizat de documente" cerut de caiet (secțiunea 4.5.2). Pentru
// producție reală s-ar folosi un obiect-store (S3/Azure Blob) în spatele aceleiași
// interfețe; pentru demo, discul local montat ca volum e suficient și mai simplu de rulat.
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const STORAGE_ROOT = process.env.STORAGE_ROOT || path.resolve(__dirname, "../../storage");

export function ensureStorageDir() {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

export function absolutePath(storagePath: string): string {
  return path.join(STORAGE_ROOT, storagePath);
}

// Generează o cale relativă unică (subfolder pe categorie, ca să nu avem mii de
// fișiere într-un singur director) — nu depinde de numele original al fișierului,
// care e păstrat separat ca metadată (Document.filename) pentru afișare/descărcare.
export function newStoragePath(category: string, extension: string): string {
  const dir = path.join(category);
  fs.mkdirSync(absolutePath(dir), { recursive: true });
  return path.join(dir, `${randomUUID()}${extension}`);
}

export function writeFile(storagePath: string, data: Buffer) {
  fs.writeFileSync(absolutePath(storagePath), data);
}

export function readFile(storagePath: string): Buffer {
  return fs.readFileSync(absolutePath(storagePath));
}
