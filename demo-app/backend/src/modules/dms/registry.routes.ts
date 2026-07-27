import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import ExcelJS from "exceljs";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireStaff } from "./rbac";
import { addBusinessDays } from "./deadline";
import { evaluateAutoTriggers } from "./caseEngine";
import { issueRegistryNumber, getDefaultRegistry } from "./registryNumbering";
import { DOCUMENT_PUBLIC_SELECT } from "./documents.routes";

export const registryRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

// Filtrare/căutare comună — folosită atât de listare cât și de export, ca rezultatele
// exportate să corespundă mereu exact filtrelor active în ecran.
function buildRequestsWhere(query: Record<string, string | undefined>) {
  const { status, category, numberKind, from, to, q } = query;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;
  if (numberKind) where.numberKind = numberKind;
  if (from || to) {
    where.registeredAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) };
  }
  if (q) {
    where.OR = [
      { submitterName: { contains: q, mode: "insensitive" } },
      { submitterEmail: { contains: q, mode: "insensitive" } },
      { registryNumber: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

// Listă documente/cereri din registratură — vizibilă doar personalului ANS. Filtrabilă
// pe status/categorie/serie de numerotare/interval de dată/text liber (submitterName,
// submitterEmail, registryNumber) — toate opționale, combinabile.
registryRouter.get("/requests", requireAuth, requireStaff(), async (req, res) => {
  const requests = await prisma.dmsRequest.findMany({
    where: buildRequestsWhere(req.query as Record<string, string>),
    include: {
      form: { select: { name: true, category: true } },
      registry: { select: { id: true, name: true, code: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedGroup: { select: { id: true, name: true } },
      workflowCase: { include: { currentState: true } },
      // Legătura intrare/intern ↔ ieșire — orice nr. de ieșire deja atribuit
      // (semnat sau trimis) unui răspuns al acestei cereri, vizibil direct în listă,
      // împreună cu data la care a fost atribuit (signedAt).
      responses: { select: { outboundNumber: true, status: true, signedAt: true }, orderBy: { createdAt: "desc" } },
    },
    orderBy: { registeredAt: "desc" },
  });
  res.json(requests);
});

// Export — respectă exact aceleași filtre ca listarea de mai sus. Înregistrat ÎNAINTE de
// /requests/:id, altfel Express l-ar potrivi pe acesta din urmă cu id="export.xlsx".
registryRouter.get("/requests/export.xlsx", requireAuth, requireStaff(), async (req, res) => {
  const requests = await prisma.dmsRequest.findMany({
    where: buildRequestsWhere(req.query as Record<string, string>),
    orderBy: { registeredAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Registratură");
  sheet.columns = [
    { header: "Nr. înregistrare", key: "registryNumber", width: 18 },
    { header: "Serie", key: "numberKind", width: 12 },
    { header: "Data înregistrării", key: "registeredAt", width: 20 },
    { header: "Petent", key: "submitterName", width: 26 },
    { header: "Email", key: "submitterEmail", width: 26 },
    { header: "Categorie", key: "category", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Termen legal", key: "legalDeadline", width: 20 },
  ];
  sheet.addRows(
    requests.map((r) => ({
      registryNumber: r.registryNumber,
      numberKind: r.numberKind,
      registeredAt: r.registeredAt.toLocaleString("ro-RO"),
      submitterName: r.submitterName,
      submitterEmail: r.submitterEmail,
      category: r.category,
      status: r.status,
      legalDeadline: r.legalDeadline ? r.legalDeadline.toLocaleDateString("ro-RO") : "",
    }))
  );

  const buffer = await workbook.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="registratura.xlsx"`);
  res.send(Buffer.from(buffer));
});

// Import în bloc (migrare dintr-un registru vechi) — dacă rândul are deja un
// `registryNumber`, îl păstrăm ca atare (istoric, numerotat de sistemul anterior);
// altfel se generează unul nou din seria INTRARE implicită (registryNumbering.ts),
// fără nicio coliziune posibilă cu numerele deja emise.
registryRouter.post("/requests/import", requireAuth, requireStaff(), upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "Niciun fișier încărcat" });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return res.status(400).json({ error: "Fișier gol" });

  const COLUMNS = ["registryNumber", "submitterName", "submitterEmail", "category", "registeredAt"];
  const headerRow = sheet.getRow(1).values as unknown[];
  const columnByIndex = new Map<number, string>();
  headerRow.forEach((header, idx) => {
    const key = COLUMNS.find((c) => c.toLowerCase() === String(header || "").trim().toLowerCase());
    if (key) columnByIndex.set(idx, key);
  });

  const defaultEntryRegistry = await getDefaultRegistry("INTRARE");
  let imported = 0;
  const errors: string[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const raw: Record<string, unknown> = {};
    (row.values as unknown[]).forEach((cell, idx) => {
      const key = columnByIndex.get(idx);
      if (key) raw[key] = cell;
    });
    if (!raw.submitterName && !raw.submitterEmail) continue; // rând gol

    try {
      const registryNumber = raw.registryNumber ? String(raw.registryNumber) : (await issueRegistryNumber(defaultEntryRegistry.id)).number;
      await prisma.dmsRequest.create({
        data: {
          registryNumber,
          numberKind: "INTRARE",
          registryId: raw.registryNumber ? null : defaultEntryRegistry.id,
          formId: null,
          submitterName: String(raw.submitterName || "Necunoscut"),
          submitterEmail: String(raw.submitterEmail || ""),
          category: String(raw.category || "import"),
          data: {},
          registeredAt: raw.registeredAt ? new Date(String(raw.registeredAt)) : new Date(),
        },
      });
      imported++;
    } catch (e: any) {
      errors.push(`Rândul ${rowNumber}: ${e.message}`);
    }
  }

  await logAction({ userId: req.user!.id, action: "REQUESTS_IMPORTED", metadata: { imported, errorCount: errors.length } });
  res.status(201).json({ imported, errors });
});

registryRouter.get("/requests/:id", requireAuth, requireStaff(), async (req, res) => {
  // Declanșatorii (Triggers) sunt evaluați "leneș" — la fiecare deschidere a detaliului
  // cererii verificăm dacă vreo tranziție automată trebuie aplicată (vezi caseEngine.ts).
  await evaluateAutoTriggers(req.params.id);

  const request = await prisma.dmsRequest.findUnique({
    where: { id: req.params.id },
    include: {
      form: {
        include: {
          sections: { include: { fields: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
          fields: { where: { sectionId: null }, orderBy: { order: "asc" } },
        },
      },
      comments: { include: { author: { select: { id: true, email: true, name: true } } }, orderBy: { createdAt: "asc" } },
      responses: {
        include: { document: { select: { ...DOCUMENT_PUBLIC_SELECT, signaturePlacements: true } } },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        where: { kind: { in: ["ATTACHMENT", "SUBMISSION_PDF"] } },
        select: { ...DOCUMENT_PUBLIC_SELECT, uploadedBy: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      assignedGroup: { select: { id: true, name: true } },
      workflowCase: {
        include: {
          workflowDef: true,
          currentState: true,
          events: {
            orderBy: { createdAt: "asc" },
            include: {
              fromState: true,
              toState: true,
              performedBy: { select: { id: true, name: true, email: true } },
              transition: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!request) return res.status(404).json({ error: "Cerere inexistentă" });
  res.json(request);
});

const updateSchema = z.object({
  category: z.string().optional(),
  domain: z.string().optional(),
  status: z.enum(["NOU", "IN_LUCRU", "IN_ASTEPTARE", "FINALIZAT", "RESPINS"]).optional(),
  suspendReason: z.string().optional(),
  suspendDays: z.number().optional(),
});

// Completare metadate suplimentare + suspendare termen cu istoric (pct. 9, Scenariul 1).
registryRouter.patch("/requests/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { category, domain, status, suspendDays, suspendReason } = parsed.data;

  const data: any = { category, domain, status };
  if (suspendDays) {
    data.suspendedUntil = addBusinessDays(new Date(), suspendDays);
  }

  const updated = await prisma.dmsRequest.update({ where: { id: req.params.id }, data });
  await logAction({
    userId: req.user!.id,
    action: suspendDays ? "REQUEST_DEADLINE_SUSPENDED" : "REQUEST_UPDATED",
    resource: `request:${updated.id}`,
    metadata: suspendDays ? { suspendDays, suspendReason } : { status },
  });
  res.json(updated);
});

export const dmsRegistrySchemas = { updateSchema };
