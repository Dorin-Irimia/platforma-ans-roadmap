import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { requireAdmin } from "./rbac";
import { extractText } from "../../shared/textExtract";

export const chatDocumentsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

// Managementul documentelor de către admin: încărcare, procesare automată (extragere
// text), disponibilizare pentru AI ca bază de cunoștințe (Scenariul 3, pct. 3).
chatDocumentsRouter.post(
  "/documents",
  requireAuth,
  requireAdmin(),
  upload.array("files", 5),
  async (req: AuthedRequest, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: "Niciun fișier trimis" });

    const created = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || "";
      const storagePath = newStoragePath("chatbot-docs", ext);
      writeFile(storagePath, file.buffer);
      const extractedText = await extractText(file.mimetype, file.buffer);

      const doc = await prisma.chatKnowledgeDocument.create({
        data: {
          uploadedById: req.user!.id,
          filename: file.originalname,
          mimeType: file.mimetype,
          storagePath,
          extractedText,
        },
      });
      created.push(doc);
    }

    await logAction({ userId: req.user!.id, action: "CHATBOT_DOCUMENT_UPLOADED", metadata: { count: created.length } });
    res.status(201).json(created);
  }
);

chatDocumentsRouter.get("/documents", requireAuth, requireAdmin(), async (_req, res) => {
  const docs = await prisma.chatKnowledgeDocument.findMany({ orderBy: { createdAt: "desc" } });
  res.json(docs);
});

chatDocumentsRouter.delete("/documents/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const doc = await prisma.chatKnowledgeDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document inexistent" });
  await prisma.chatKnowledgeDocument.delete({ where: { id: doc.id } });
  await logAction({ userId: req.user!.id, action: "CHATBOT_DOCUMENT_DELETED", resource: `chatdoc:${doc.id}` });
  res.json({ deleted: true });
});

chatDocumentsRouter.get("/documents/:id/file", requireAuth, requireAdmin(), async (req, res) => {
  const doc = await prisma.chatKnowledgeDocument.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document inexistent" });
  const buffer = readFile(doc.storagePath);
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.filename)}"`);
  res.send(buffer);
});
