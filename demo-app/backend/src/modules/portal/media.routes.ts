import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { STAFF_ROLES } from "../dms/rbac";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { logAction } from "../iam/audit.service";

// Bibliotecă media (4.5.1 R98) + documente reutilizabile SPV (R46) — același model
// `MediaAsset`, diferențiat prin `isPersonal`: true = apare doar în SPV-ul propriu
// (documente justificative reutilizabile la depunere), false = bibliotecă media generală
// (STAFF_ROLES), folosibilă ca sursă pentru bannere/imagini în paginile CMS.
export const mediaRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

mediaRouter.post("/media", requireAuth, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Niciun fișier trimis" });
  const isPersonal = req.body?.isPersonal !== "false";
  // Doar STAFF_ROLES pot publica în biblioteca media generală — oricine autentificat
  // poate încărca în propriul SPV personal.
  if (!isPersonal && !(STAFF_ROLES as readonly string[]).includes(req.user!.role)) {
    return res.status(403).json({ error: "Doar personalul poate publica în biblioteca media generală" });
  }

  const ext = path.extname(req.file.originalname) || "";
  const storagePath = newStoragePath("media-assets", ext);
  writeFile(storagePath, req.file.buffer);

  const asset = await prisma.mediaAsset.create({
    data: {
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath,
      isPersonal,
      uploadedById: req.user!.id,
    },
  });
  await logAction({ userId: req.user!.id, action: "MEDIA_UPLOADED", resource: `media:${asset.id}`, metadata: { isPersonal } });
  res.status(201).json(asset);
});

mediaRouter.get("/media", requireAuth, async (req: AuthedRequest, res) => {
  const mine = req.query.mine === "true";
  if (mine) {
    const assets = await prisma.mediaAsset.findMany({ where: { uploadedById: req.user!.id, isPersonal: true }, orderBy: { createdAt: "desc" } });
    return res.json(assets);
  }
  // Biblioteca generală — doar STAFF_ROLES.
  if (!(STAFF_ROLES as readonly string[]).includes(req.user!.role)) return res.status(403).json({ error: "Acces interzis" });
  const assets = await prisma.mediaAsset.findMany({ where: { isPersonal: false }, orderBy: { createdAt: "desc" } });
  res.json(assets);
});

mediaRouter.get("/media/:id/file", requireAuth, async (req: AuthedRequest, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ error: "Fișier inexistent" });
  const isOwner = asset.uploadedById === req.user!.id;
  const isStaff = (STAFF_ROLES as readonly string[]).includes(req.user!.role);
  if (asset.isPersonal && !isOwner && !isStaff) return res.status(403).json({ error: "Acces interzis" });
  res.setHeader("Content-Type", asset.mimeType);
  res.send(readFile(asset.storagePath));
});

mediaRouter.delete("/media/:id", requireAuth, async (req: AuthedRequest, res) => {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: req.params.id } });
  if (!asset) return res.status(404).json({ error: "Fișier inexistent" });
  const isOwner = asset.uploadedById === req.user!.id;
  const isStaff = (STAFF_ROLES as readonly string[]).includes(req.user!.role);
  if (!isOwner && !isStaff) return res.status(403).json({ error: "Acces interzis" });
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  res.json({ deleted: true });
});
