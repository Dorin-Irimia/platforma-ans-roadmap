import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";

export const lmsMediaRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

// Upload de imagini/clipuri video pentru blocurile de lecție (BlockEditor.tsx). Reutilizează
// modelul MediaAsset (portal/media.routes.ts), dar servirea fișierului aici e publică, fără
// requireAuth — la fel ca fotografiile din muzeu (museum/artifacts.routes.ts) — pentru că
// odată atașată unei lecții, imaginea/videoclipul trebuie afișat prin <img>/<video> oricărui
// cursant înscris, iar un tag <img>/<video> nu poate trimite header-ul Authorization Bearer
// pe care se bazează restul aplicației. isPersonal: false — nu e document SPV, e conținut
// public de curs (apare și în biblioteca media generală, reutilizabil).
lmsMediaRouter.post("/media", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Niciun fișier trimis" });
  const ext = path.extname(req.file.originalname) || "";
  const storagePath = newStoragePath("lms-media", ext);
  writeFile(storagePath, req.file.buffer);
  const asset = await prisma.mediaAsset.create({
    data: {
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath,
      isPersonal: false,
      uploadedById: req.user!.id,
    },
  });
  res.status(201).json({ id: asset.id, url: `/api/lms/media/${asset.id}/file`, filename: asset.filename, mimeType: asset.mimeType });
});

lmsMediaRouter.get("/media/:id/file", async (req, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ error: "Fișier inexistent" });
  res.setHeader("Content-Type", asset.mimeType);
  res.send(readFile(asset.storagePath));
});
