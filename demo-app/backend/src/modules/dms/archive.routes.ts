import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "./rbac";
import { logAction } from "../iam/audit.service";
import { readFile, writeFile } from "../../shared/storage";
import { encryptBuffer } from "../../shared/crypto";
import { DOCUMENT_PUBLIC_SELECT } from "./documents.routes";

export const archiveRouter = Router();

const MAX_DOCUMENTS_PER_FOLDER = 250;
const MAX_INDEX_FIELDS = 5;

const folderSchema = z.object({
  name: z.string().min(1),
  indexFields: z.array(z.object({ label: z.string(), value: z.string() })).max(MAX_INDEX_FIELDS).default([]),
});

archiveRouter.get("/archive/folders", requireAuth, requireStaff(), async (_req, res) => {
  const settings = await prisma.archiveSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const stalledMs = settings.stalledAfterDays * 86_400_000;
  const folders = await prisma.archiveFolder.findMany({
    include: { _count: { select: { documents: true } } },
    orderBy: { createdAt: "desc" },
  });
  // Regulă automată (evaluată leneș, la listare): un dosar neschimbat de etapă de atâtea
  // zile e semnalat "stagnant" — nu blochează nimic, doar atrage atenția arhivarului.
  res.json(
    folders.map((f) => ({
      ...f,
      stalled: f.stage !== "ARCHIVED" && Date.now() - f.updatedAt.getTime() > stalledMs,
    }))
  );
});

archiveRouter.post("/archive/folders", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = folderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const folder = await prisma.archiveFolder.create({ data: { name: parsed.data.name, indexFields: parsed.data.indexFields } });
  await logAction({ userId: req.user!.id, action: "ARCHIVE_FOLDER_CREATED", resource: `archivefolder:${folder.id}` });
  res.status(201).json(folder);
});

archiveRouter.get("/archive/folders/:id", requireAuth, requireStaff(), async (req, res) => {
  const folder = await prisma.archiveFolder.findUnique({
    where: { id: req.params.id },
    include: { documents: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true } } },
  });
  if (!folder) return res.status(404).json({ error: "Dosar inexistent" });
  res.json(folder);
});

const updateFolderSchema = z.object({
  name: z.string().min(1).optional(),
  stage: z.enum(["INTAKE", "GROUPED", "BOUND", "INVENTORIED", "DIGITIZED", "INDEXED", "ARCHIVED"]).optional(),
  indexFields: z.array(z.object({ label: z.string(), value: z.string() })).max(MAX_INDEX_FIELDS).optional(),
});

archiveRouter.patch("/archive/folders/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = updateFolderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const folder = await prisma.archiveFolder.update({ where: { id: req.params.id }, data: parsed.data as any });
  await logAction({ userId: req.user!.id, action: "ARCHIVE_FOLDER_UPDATED", resource: `archivefolder:${folder.id}`, metadata: { stage: folder.stage } });
  res.json(folder);
});

const assignSchema = z.object({ documentIds: z.array(z.string()).min(1) });

// Asociere documente deja existente în DMS unui dosar de arhivă — respectă limita de
// 250 fișiere/dosar (cerință explicită 4.5.9), fără a muta/duplica fișierul fizic.
archiveRouter.post("/archive/folders/:id/documents", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const folder = await prisma.archiveFolder.findUnique({ where: { id: req.params.id }, include: { _count: { select: { documents: true } } } });
  if (!folder) return res.status(404).json({ error: "Dosar inexistent" });

  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (folder._count.documents + parsed.data.documentIds.length > MAX_DOCUMENTS_PER_FOLDER) {
    return res.status(409).json({ error: `Dosarul ar depăși limita de ${MAX_DOCUMENTS_PER_FOLDER} documente` });
  }

  // Criptare la arhivare (cerință tehnică 4.5.9) — fiecare document asociat e recitit,
  // criptat (AES-256-GCM, shared/crypto.ts) și rescris pe disc; nu e doar o asociere de
  // metadate, fișierul devine efectiv ciphertext, decriptat doar la servire.
  const documents = await prisma.document.findMany({ where: { id: { in: parsed.data.documentIds } } });
  for (const doc of documents) {
    if (doc.isEncrypted) continue; // deja criptat — nu recriptăm peste un ciphertext existent
    const plain = readFile(doc.storagePath);
    writeFile(doc.storagePath, encryptBuffer(plain));
  }

  await prisma.document.updateMany({
    where: { id: { in: parsed.data.documentIds } },
    data: { archiveFolderId: folder.id, isEncrypted: true },
  });

  await logAction({ userId: req.user!.id, action: "ARCHIVE_DOCUMENTS_ASSIGNED", resource: `archivefolder:${folder.id}`, metadata: { count: parsed.data.documentIds.length } });
  res.json({ assigned: parsed.data.documentIds.length });
});

// Căutare full-text pe documentele deja asociate unui dosar — reutilizează câmpul
// `filename` existent (Postgres ILIKE); fără OCR real pe scanări fizice (scope cut
// asumat explicit, vezi README).
archiveRouter.get("/archive/search", requireAuth, requireStaff(), async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) return res.json([]);
  const documents = await prisma.document.findMany({
    where: { archiveFolderId: { not: null }, filename: { contains: q, mode: "insensitive" } },
    select: { ...DOCUMENT_PUBLIC_SELECT, archiveFolder: { select: { id: true, name: true } } },
    take: 50,
  });
  res.json(documents);
});
