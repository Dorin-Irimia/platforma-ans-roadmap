// Nomenclatoare — liste de referință reutilizabile (ex. "Persoane": nume/prenume/CNP/
// data nașterii/oraș), atașabile unui șablon de formular. La completare (Portal), o
// intrare aleasă precompletează automat câmpurile mapate din formular.
import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../../shared/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff, requireAdmin } from "../dms/rbac";
import { logAction } from "../iam/audit.service";

export const nomenclatoareRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

const fieldSchema = z.object({ key: z.string().min(1), label: z.string().min(1), type: z.enum(["TEXT", "NUMBER", "DATE"]) });
const nomenclatorSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(fieldSchema).min(1),
});

nomenclatoareRouter.get("/nomenclatoare", requireAuth, requireStaff(), async (_req, res) => {
  const rows = await prisma.nomenclator.findMany({ include: { _count: { select: { entries: true } } }, orderBy: { name: "asc" } });
  res.json(rows);
});

nomenclatoareRouter.post("/nomenclatoare", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = nomenclatorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.nomenclator.create({ data: parsed.data as any });
  await logAction({ userId: req.user!.id, action: "NOMENCLATOR_CREATED", resource: `nomenclator:${created.id}` });
  res.status(201).json(created);
});

nomenclatoareRouter.get("/nomenclatoare/:id", requireAuth, requireStaff(), async (req, res) => {
  const row = await prisma.nomenclator.findUnique({ where: { id: req.params.id }, include: { entries: { orderBy: { createdAt: "asc" } } } });
  if (!row) return res.status(404).json({ error: "Nomenclator inexistent" });
  res.json(row);
});

nomenclatoareRouter.patch("/nomenclatoare/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = nomenclatorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.nomenclator.update({ where: { id: req.params.id }, data: parsed.data as any });
  await logAction({ userId: req.user!.id, action: "NOMENCLATOR_UPDATED", resource: `nomenclator:${updated.id}` });
  res.json(updated);
});

nomenclatoareRouter.delete("/nomenclatoare/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  await prisma.nomenclator.delete({ where: { id: req.params.id } });
  await logAction({ userId: req.user!.id, action: "NOMENCLATOR_DELETED", resource: `nomenclator:${req.params.id}` });
  res.status(204).end();
});

const entrySchema = z.object({ values: z.record(z.any()) });

nomenclatoareRouter.post("/nomenclatoare/:id/entries", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const created = await prisma.nomenclatorEntry.create({ data: { nomenclatorId: req.params.id, values: parsed.data.values } });
  res.status(201).json(created);
});

nomenclatoareRouter.patch("/nomenclatoare/:id/entries/:entryId", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = await prisma.nomenclatorEntry.update({ where: { id: req.params.entryId }, data: { values: parsed.data.values } });
  res.json(updated);
});

nomenclatoareRouter.delete("/nomenclatoare/:id/entries/:entryId", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  await prisma.nomenclatorEntry.delete({ where: { id: req.params.entryId } });
  res.status(204).end();
});

// Import în bloc din Excel — prima linie = anteturi, mapate pe `fields[].label` (nu `.key`,
// ca fișierul să poată fi completat de cineva care nu cunoaște cheile interne).
nomenclatoareRouter.post("/nomenclatoare/:id/import", requireAuth, requireStaff(), upload.single("file"), async (req: AuthedRequest, res) => {
  const nomenclator = await prisma.nomenclator.findUnique({ where: { id: req.params.id } });
  if (!nomenclator) return res.status(404).json({ error: "Nomenclator inexistent" });
  if (!req.file) return res.status(400).json({ error: "Niciun fișier încărcat" });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: "Fișier gol" });

  const fields = nomenclator.fields as { key: string; label: string }[];
  const headerRow = sheet.getRow(1).values as unknown[]; // index 0 e mereu gol (ExcelJS e 1-indexat)
  const columnKeyByIndex = new Map<number, string>();
  headerRow.forEach((header, idx) => {
    const field = fields.find((f) => f.label === String(header).trim());
    if (field) columnKeyByIndex.set(idx, field.key);
  });

  let imported = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, unknown> = {};
    (row.values as unknown[]).forEach((cell, idx) => {
      const key = columnKeyByIndex.get(idx);
      if (key !== undefined && cell !== null && cell !== undefined) values[key] = cell;
    });
    if (Object.keys(values).length > 0) {
      imported++;
      prisma.nomenclatorEntry.create({ data: { nomenclatorId: nomenclator.id, values: values as any } }).catch(() => {});
    }
  });

  await logAction({ userId: req.user!.id, action: "NOMENCLATOR_IMPORTED", resource: `nomenclator:${nomenclator.id}`, metadata: { imported } });
  res.status(201).json({ imported });
});

nomenclatoareRouter.get("/nomenclatoare/:id/export.xlsx", requireAuth, requireStaff(), async (req, res) => {
  const nomenclator = await prisma.nomenclator.findUnique({
    where: { id: req.params.id },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });
  if (!nomenclator) return res.status(404).json({ error: "Nomenclator inexistent" });

  const fields = nomenclator.fields as { key: string; label: string }[];
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(nomenclator.name.slice(0, 31));
  sheet.columns = fields.map((f) => ({ header: f.label, key: f.key, width: 22 }));
  sheet.addRows(nomenclator.entries.map((e) => e.values as Record<string, unknown>));

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nomenclator.name}.xlsx"`);
  res.send(Buffer.from(buffer));
});

// ------------------------------------------------------------
// Legătura nomenclator ↔ formular (Form Builder) — atașare/eliminare + citire publică
// (Portal, pentru precompletare la depunere).
// ------------------------------------------------------------

const linkSchema = z.object({ nomenclatorId: z.string(), fieldMapping: z.record(z.string()) });

nomenclatoareRouter.post("/forms/:formId/nomenclator-links", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const link = await prisma.formNomenclatorLink.create({
    data: { formId: req.params.formId, nomenclatorId: parsed.data.nomenclatorId, fieldMapping: parsed.data.fieldMapping },
  });
  await logAction({ userId: req.user!.id, action: "FORM_NOMENCLATOR_LINKED", resource: `form:${req.params.formId}` });
  res.status(201).json(link);
});

nomenclatoareRouter.delete("/forms/:formId/nomenclator-links/:linkId", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  await prisma.formNomenclatorLink.delete({ where: { id: req.params.linkId } });
  res.status(204).end();
});

// Formularul e public (Portal) — nomenclatoarele atașate trebuie citite la același nivel
// de acces ca formularul însuși, altfel precompletarea n-ar funcționa pentru un cetățean.
nomenclatoareRouter.get("/forms/:formId/nomenclator-links", optionalAuth, async (req, res) => {
  const links = await prisma.formNomenclatorLink.findMany({
    where: { formId: req.params.formId },
    include: { nomenclator: { include: { entries: { orderBy: { createdAt: "asc" } } } } },
  });
  res.json(links);
});
