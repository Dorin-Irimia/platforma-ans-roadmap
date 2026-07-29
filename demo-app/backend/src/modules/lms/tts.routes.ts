import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { newStoragePath, absolutePath, readFile } from "../../shared/storage";

export const lmsTtsRouter = Router();

const execFileAsync = promisify(execFile);

// Generare reală a unui fișier audio descărcabil dintr-un text (pct. 11) — spre deosebire
// de redarea live din browser (Web Speech API, `speakText` în frontend), aici serverul
// produce un fișier .wav propriu-zis, prin `espeak-ng` (motor TTS offline, instalat în
// imaginea Docker Alpine — vezi backend/Dockerfile). Nu se persistă un rând în DB:
// cerința e generarea unui fișier descărcabil, nu un istoric al ei.
// Limita a fost 2000, prea mică pentru "descarcă audio lecția întreagă" (o lecție reală
// cu mai multe blocuri TEXT poate trece ușor de 5-6000 de caractere) — mărită la 10000,
// suficient pentru orice lecție rezonabilă, fără să riște un argument de linie de comandă
// nepractic de lung pentru espeak-ng.
// `rate` — același multiplicator de viteză ca la redarea live (Web Speech API, 1 = normal),
// ales din același meniu de accesibilitate — aplicat aici prin `-s` (cuvinte/minut) al
// espeak-ng, pornind de la viteza lui implicită (~175 wpm).
const ttsSchema = z.object({ text: z.string().min(1).max(10000), rate: z.number().min(0.5).max(2.5).optional() });
const ESPEAK_DEFAULT_WPM = 175;

lmsTtsRouter.post("/tts", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const storagePath = newStoragePath("lms-tts", ".wav");
  const outputPath = absolutePath(storagePath);
  const wpm = Math.round(ESPEAK_DEFAULT_WPM * (parsed.data.rate ?? 1));

  try {
    await execFileAsync("espeak-ng", ["-v", "ro", "-s", String(wpm), "-w", outputPath, parsed.data.text]);
    const buffer = readFile(storagePath);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Disposition", 'attachment; filename="lectie-audio.wav"');
    res.send(buffer);
  } catch (e: any) {
    res.status(500).json({ error: `Generarea fișierului audio a eșuat (${e?.message || "eroare necunoscută"})` });
  } finally {
    fs.unlink(outputPath, () => {});
  }
});
