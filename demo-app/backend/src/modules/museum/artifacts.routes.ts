import { Router } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "../dms/rbac";
import { logAction } from "../iam/audit.service";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";

export const artifactsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const artifactSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  isFragile: z.coerce.boolean().optional(),
});

// Catalog public — vizibil oricui (nu doar personalului), pentru vitrina digitală.
artifactsRouter.get("/artifacts", async (_req, res) => {
  const artifacts = await prisma.museumArtifact.findMany({ orderBy: { createdAt: "desc" } });
  res.json(artifacts);
});

artifactsRouter.post("/artifacts", requireAuth, requireStaff(), upload.single("photo"), async (req: AuthedRequest, res) => {
  const parsed = artifactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let photoStoragePath: string | undefined;
  let photoMimeType: string | undefined;
  if (req.file) {
    const ext = path.extname(req.file.originalname) || "";
    photoStoragePath = newStoragePath("museum-artifacts", ext);
    writeFile(photoStoragePath, req.file.buffer);
    photoMimeType = req.file.mimetype;
  }

  const artifact = await prisma.museumArtifact.create({
    data: { ...parsed.data, isFragile: !!parsed.data.isFragile, photoStoragePath, photoMimeType },
  });
  await logAction({ userId: req.user!.id, action: "MUSEUM_ARTIFACT_CREATED", resource: `artifact:${artifact.id}` });
  res.status(201).json(artifact);
});

artifactsRouter.delete("/artifacts/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  await prisma.museumArtifact.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "MUSEUM_ARTIFACT_DELETED", resource: `artifact:${req.params.id}` });
  res.json({ deleted: true });
});

artifactsRouter.get("/artifacts/:id/photo", async (req, res) => {
  const artifact = await prisma.museumArtifact.findUnique({ where: { id: req.params.id } });
  if (!artifact?.photoStoragePath) return res.status(404).json({ error: "Fără fotografie" });
  const buffer = readFile(artifact.photoStoragePath);
  res.setHeader("Content-Type", artifact.photoMimeType || "application/octet-stream");
  res.send(buffer);
});
