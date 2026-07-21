import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin, requireStaff } from "./rbac";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";
import { generateResponsePdf } from "./pdf";
import { stampSignature } from "./signature";
import { issueRegistryNumber, getDefaultRegistry } from "./registryNumbering";
import { extractText } from "../../shared/textExtract";
import { DOCUMENT_PUBLIC_SELECT } from "./documents.routes";

export const responsesRouter = Router();

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  body: z.string().min(1), // conține variabile {{NUME}}, {{NR_INREGISTRARE}} etc.
  outboundMode: z.enum(["SAME_AS_ENTRY", "FROM_REGISTRY"]).optional(),
  outboundRegistryId: z.string().nullable().optional(),
});

// Template-uri de răspuns oficial, configurabile per categorie de document — inclusiv
// strategia de nr. de ieșire (același ca nr. de intrare / următorul dintr-un registru ales).
responsesRouter.post("/response-templates", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.responseTemplate.create({ data: parsed.data });
  await logAction({ userId: req.user!.id, action: "RESPONSE_TEMPLATE_CREATED", resource: `template:${template.id}` });
  res.status(201).json(template);
});

responsesRouter.get("/response-templates", requireAuth, requireStaff(), async (_req, res) => {
  const templates = await prisma.responseTemplate.findMany({ orderBy: { createdAt: "desc" }, include: { outboundRegistry: { select: { id: true, name: true, code: true } } } });
  res.json(templates);
});

const templateUpdateSchema = templateSchema.partial();

responsesRouter.patch("/response-templates/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = templateUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const template = await prisma.responseTemplate.update({ where: { id: req.params.id }, data: parsed.data });
  await logAction({ userId: req.user!.id, action: "RESPONSE_TEMPLATE_UPDATED", resource: `template:${template.id}` });
  res.json(template);
});

function renderTemplate(body: string, variables: Record<string, unknown>): string {
  return body.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key) => {
    const value = variables[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });
}

const generateSchema = z.object({ templateId: z.string() });

// Extras ca funcție reutilizabilă (nu doar handler HTTP) pentru ca Acțiunea de
// workflow GENERATE_DOCUMENT (caseEngine.ts) să poată produce același document
// real (PDF + OfficialResponse), automat, la aplicarea unei tranziții.
export async function generateResponseForRequest(requestId: string, templateId: string, actorId: string | null) {
  const request = await prisma.dmsRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Cerere inexistentă");

  const template = await prisma.responseTemplate.findUnique({ where: { id: templateId } });
  if (!template) throw new Error("Șablon inexistent");

  const variables: Record<string, unknown> = {
    NUME: request.submitterName,
    EMAIL: request.submitterEmail,
    NR_INREGISTRARE: request.registryNumber,
    DATA: new Date().toLocaleDateString("ro-RO"),
    ...(typeof request.data === "object" && request.data ? (request.data as Record<string, unknown>) : {}),
  };

  const body = renderTemplate(template.body, variables);

  const response = await prisma.officialResponse.create({
    data: { requestId: request.id, templateId: template.id, body },
  });

  const pdfBuffer = await generateResponsePdf({
    institutionName: "Agenția Națională pentru Sport",
    registryNumber: request.registryNumber,
    date: new Date().toLocaleDateString("ro-RO"),
    submitterName: request.submitterName,
    submitterEmail: request.submitterEmail,
    body,
  });

  const storagePath = newStoragePath("responses", ".pdf");
  writeFile(storagePath, pdfBuffer);
  const extractedText = await extractText("application/pdf", pdfBuffer);

  const document = await prisma.document.create({
    data: {
      kind: "GENERATED_RESPONSE",
      requestId: request.id,
      responseId: response.id,
      filename: `raspuns-${request.registryNumber.replace("/", "-")}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: pdfBuffer.length,
      storagePath,
      extractedText,
      uploadedById: actorId,
    },
    select: DOCUMENT_PUBLIC_SELECT,
  });

  if (actorId) {
    await logAction({ userId: actorId, action: "RESPONSE_GENERATED", resource: `request:${request.id}` });
  }
  return { ...response, document };
}

// Generarea răspunsului oficial dintr-un template standard, cu auto-completare a
// câmpurilor dinamice (pct. 14, Scenariul 1) — produce acum un PDF real (PDFKit),
// nu doar text, ca să poată fi previzualizat și semnat ca document.
responsesRouter.post("/requests/:id/responses", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await generateResponseForRequest(req.params.id, parsed.data.templateId, req.user!.id);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(404).json({ error: err.message || "Cerere sau șablon inexistent" });
  }
});

const placementSchema = z.object({
  page: z.number().min(0),
  xRatio: z.number().min(0).max(1),
  yRatio: z.number().min(0).max(1),
  widthRatio: z.number().min(0.01).max(1),
  heightRatio: z.number().min(0.01).max(1),
});

// Poziționarea ștampilei de semnătură pe document — pattern DocuSign/PandaDoc:
// utilizatorul dă click pe pagina previzualizată, frontend-ul trimite poziția
// relativă (independentă de zoom), noi o salvăm ca să fie aplicată la semnare.
responsesRouter.post("/responses/:id/signature-placement", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = placementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const response = await prisma.officialResponse.findUnique({ where: { id: req.params.id }, include: { document: true } });
  if (!response) return res.status(404).json({ error: "Răspuns inexistent" });
  if (!response.document) return res.status(409).json({ error: "Documentul nu a fost încă generat" });
  if (response.status !== "DRAFT") return res.status(409).json({ error: "Documentul e deja semnat" });

  // O singură poziționare activă per document — o înlocuim dacă există deja.
  await prisma.signaturePlacement.deleteMany({ where: { documentId: response.document.id } });
  const placement = await prisma.signaturePlacement.create({
    data: { documentId: response.document.id, createdById: req.user!.id, ...parsed.data },
  });

  res.status(201).json(placement);
});

// Semnătură electronică — ștampilează efectiv PDF-ul (pdf-lib) la poziția aleasă
// și atribuie numărul de ieșire; publicarea efectivă se face la /send (pct. 16).
responsesRouter.post("/responses/:id/sign", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const existing = await prisma.officialResponse.findUnique({
    where: { id: req.params.id },
    include: { document: { include: { signaturePlacements: true } }, template: true, request: true },
  });
  if (!existing) return res.status(404).json({ error: "Răspuns inexistent" });
  if (existing.status !== "DRAFT") return res.status(409).json({ error: "Răspunsul a fost deja semnat" });
  if (!existing.document) return res.status(409).json({ error: "Documentul nu a fost încă generat" });

  const signer = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const signedAt = new Date();

  const placement = existing.document.signaturePlacements[0];
  const originalBytes = readFile(existing.document.storagePath);
  const stampedBuffer = await stampSignature({
    pdfBytes: originalBytes,
    page: placement?.page ?? 0,
    xRatio: placement?.xRatio ?? 0.62,
    yRatio: placement?.yRatio ?? 0.82,
    widthRatio: placement?.widthRatio ?? 0.3,
    heightRatio: placement?.heightRatio ?? 0.1,
    signerName: signer?.name || signer?.email || "Necunoscut",
    signedAtIso: signedAt.toISOString(),
  });

  const signedStoragePath = newStoragePath("responses-signed", ".pdf");
  writeFile(signedStoragePath, stampedBuffer);

  // Actualizăm documentul existent (nu creăm unul nou) — păstrăm același id, ca
  // frontend-ul care are deja referința să vadă imediat versiunea semnată la reîncărcare.
  const signedDocument = await prisma.document.update({
    where: { id: existing.document.id },
    data: {
      kind: "SIGNED_RESPONSE",
      filename: existing.document.filename.replace(/\.pdf$/, "-semnat.pdf"),
      sizeBytes: stampedBuffer.length,
      storagePath: signedStoragePath,
    },
    select: DOCUMENT_PUBLIC_SELECT,
  });

  // Strategia de nr. de ieșire e configurată pe șablon (vezi ResponseTemplate.outboundMode):
  // fie oglindește nr. de intrare/intern al cererii, fie extrage următorul număr dintr-un
  // registru — cel ales explicit pe șablon, sau registrul IESIRE implicit dacă nu s-a ales unul.
  let outboundNumber: string;
  if (existing.template?.outboundMode === "SAME_AS_ENTRY") {
    outboundNumber = existing.request.registryNumber;
  } else {
    const registry = existing.template?.outboundRegistryId
      ? await prisma.numberingRegistry.findUniqueOrThrow({ where: { id: existing.template.outboundRegistryId } })
      : await getDefaultRegistry("IESIRE");
    ({ number: outboundNumber } = await issueRegistryNumber(registry.id));
  }

  const updated = await prisma.officialResponse.update({
    where: { id: req.params.id },
    data: { status: "SIGNED", signedById: req.user!.id, signedAt, outboundNumber },
    include: { document: { select: DOCUMENT_PUBLIC_SELECT } },
  });

  await logAction({
    userId: req.user!.id,
    action: "RESPONSE_SIGNED",
    resource: `response:${updated.id}`,
    metadata: { outboundNumber, signedDocumentId: signedDocument.id },
  });

  res.json({ ...updated, signedDocument });
});

// Publicare răspuns în contul utilizatorului din Portal + notificare (simulată prin log/audit).
responsesRouter.post("/responses/:id/send", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const existing = await prisma.officialResponse.findUnique({ where: { id: req.params.id }, include: { request: true } });
  if (!existing) return res.status(404).json({ error: "Răspuns inexistent" });
  if (existing.status !== "SIGNED") return res.status(409).json({ error: "Răspunsul trebuie semnat înainte de a fi trimis" });

  const updated = await prisma.officialResponse.update({ where: { id: req.params.id }, data: { status: "SENT" } });
  await prisma.dmsRequest.update({ where: { id: existing.requestId }, data: { status: "FINALIZAT" } });

  await logAction({
    userId: req.user!.id,
    action: "RESPONSE_SENT",
    resource: `response:${updated.id}`,
    metadata: { notifiedEmail: existing.request.submitterEmail },
  });
  res.json(updated);
});
