import { Router } from "express";
import multer from "multer";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireStaff, STAFF_ROLES } from "./rbac";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { decryptBuffer } from "../../shared/crypto";
import { extractText } from "../../shared/textExtract";

export const documentsRouter = Router();

// Fișierele trec prin memorie (demo, volume mici) și sunt scrise pe disc prin
// helper-ul din shared/storage.ts — vezi acel fișier pentru justificarea alegerii.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 5 } });

// Selecție explicită folosită oriunde un Document e întors spre frontend — exclude
// `extractedText` (poate fi mare, e folosit exclusiv intern de chatbot pentru
// fundamentare pe Arhivă, vezi chatbot/archiveContext.ts, nu are ce căuta în JSON-ul
// trimis către client).
export const DOCUMENT_PUBLIC_SELECT = {
  id: true,
  kind: true,
  requestId: true,
  responseId: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  storagePath: true,
  pageCount: true,
  uploadedById: true,
  createdAt: true,
  archiveFolderId: true,
  isEncrypted: true,
} as const;

async function pageCountFor(mimeType: string, buffer: Buffer): Promise<number | undefined> {
  if (mimeType !== "application/pdf") return undefined;
  try {
    const doc = await PDFDocument.load(buffer);
    return doc.getPageCount();
  } catch {
    return undefined;
  }
}

// Asociere documente atașate la o cerere, fără a necesita descărcare locală
// ulterioară — pot fi previzualizate/descărcate direct din Back-Office (pct. 9, Scenariul 1).
documentsRouter.post(
  "/requests/:id/attachments",
  requireAuth,
  requireStaff(),
  upload.array("files", 5),
  async (req: AuthedRequest, res) => {
    const request = await prisma.dmsRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ error: "Cerere inexistentă" });

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) return res.status(400).json({ error: "Niciun fișier trimis" });

    const created = [];
    for (const file of files) {
      const ext = path.extname(file.originalname) || "";
      const storagePath = newStoragePath("attachments", ext);
      writeFile(storagePath, file.buffer);
      const pageCount = await pageCountFor(file.mimetype, file.buffer);
      const extractedText = await extractText(file.mimetype, file.buffer);

      const doc = await prisma.document.create({
        data: {
          kind: "ATTACHMENT",
          requestId: request.id,
          filename: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storagePath,
          pageCount,
          extractedText,
          uploadedById: req.user!.id,
        },
        select: DOCUMENT_PUBLIC_SELECT,
      });
      created.push(doc);
    }

    await logAction({
      userId: req.user!.id,
      action: "ATTACHMENT_UPLOADED",
      resource: `request:${request.id}`,
      metadata: { count: created.length },
    });

    res.status(201).json(created);
  }
);

documentsRouter.get("/requests/:id/attachments", requireAuth, requireStaff(), async (req, res) => {
  const docs = await prisma.document.findMany({
    where: { requestId: req.params.id, kind: "ATTACHMENT" },
    select: { ...DOCUMENT_PUBLIC_SELECT, uploadedBy: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(docs);
});

documentsRouter.delete("/documents/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc) return res.status(404).json({ error: "Document inexistent" });
  if (doc.kind !== "ATTACHMENT") return res.status(400).json({ error: "Doar atașamentele pot fi șterse manual" });

  await prisma.document.delete({ where: { id: doc.id } });
  await logAction({ userId: req.user!.id, action: "ATTACHMENT_DELETED", resource: `document:${doc.id}` });
  res.json({ deleted: true });
});

// Servire fișier — atașamente, PDF-uri generate sau semnate. Vizualizare directă
// în browser (preview) fără a necesita descărcare locală prealabilă. Personalul ANS
// vede orice document; cetățeanul (contul din Portal) poate vedea doar propriile
// atașamente și răspunsul oficial deja semnat/trimis (nu ciornele interne) — cerință
// Scenariul 1, pct. 16: "publicare răspuns în contul utilizatorului din Portal".
documentsRouter.get("/documents/:id/file", requireAuth, async (req: AuthedRequest, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id }, include: { request: true } });
  if (!doc) return res.status(404).json({ error: "Document inexistent" });

  const isStaff = (STAFF_ROLES as readonly string[]).includes(req.user!.role);
  const isOwner =
    doc.request?.submitterId === req.user!.id &&
    (doc.kind === "ATTACHMENT" || doc.kind === "SIGNED_RESPONSE" || doc.kind === "SUBMISSION_PDF");
  if (!isStaff && !isOwner) return res.status(403).json({ error: "Acces interzis" });

  const raw = readFile(doc.storagePath);
  const buffer = doc.isEncrypted ? decryptBuffer(raw) : raw;
  res.setHeader("Content-Type", doc.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.filename)}"`);
  res.send(buffer);
});
