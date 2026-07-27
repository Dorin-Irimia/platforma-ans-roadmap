import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, optionalAuth, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { requireAdmin } from "./rbac";
import { addBusinessDays, DEFAULT_LEGAL_DEADLINE_DAYS } from "./deadline";
import { generateFormPdf, generateSubmissionPdf } from "./pdf";
import { newStoragePath, writeFile } from "../../shared/storage";
import { issueRegistryNumber, getDefaultRegistry } from "./registryNumbering";
import { DOCUMENT_PUBLIC_SELECT } from "./documents.routes";

export const formsRouter = Router();

// Oglindește enum-ul Prisma `FieldType` (vezi schema.prisma) — bibliotecă extinsă
// de tipuri de câmpuri, organizată pe categorii (Sistem/General/Timp/Locație/Opțiuni/Aspect).
const FIELD_TYPES = [
  "ACCOUNT",
  "REGISTRATION",
  "REPEATABLE_GROUP",
  "NOTIFICATION_TEMPLATE",
  "NOTIFICATION_RECIPIENTS",
  "DYNAMIC_FORM_BUILDER",
  "DYNAMIC_FORM_RENDER",
  "ACCESS_DEFINITION",
  "SHORT_TEXT",
  "SHORT_NUMBER",
  "LONG_TEXT",
  "EMAIL",
  "FILE_UPLOAD_AI",
  "CARD_EXTRACT_AI",
  "FILE_UPLOAD",
  "DATE",
  "DATETIME",
  "TIME",
  "SCHEDULE",
  "MAP_POINT",
  "REGION",
  "DROPDOWN",
  "CHECKBOX",
  "RADIO",
  "NESTED_CHECKBOXES",
  "MULTI_CHECKBOX",
  "SURVEY",
  "TOGGLE",
  "STAR_RATING",
  "SCALE",
  "STATIC_TEXT",
  "LINK",
  "MEDIA",
] as const;

const conditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals"]),
  value: z.string(),
});

const fieldSchema = z.object({
  key: z.string().min(1),
  internalTitle: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().optional().default(false),
  disabled: z.boolean().optional().default(false),
  readOnly: z.boolean().optional().default(false),
  label: z.string().min(1),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  textIndicator: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  defaultValue: z.string().optional(),
  allowAiAutofill: z.boolean().optional().default(false),
  autofillFromProfile: z.boolean().optional().default(false),
  config: z.record(z.any()).optional(),
  conditions: z.array(conditionSchema).optional(),
  order: z.number().optional().default(0),
  canonicalRole: z.enum(["NUME", "EMAIL", "CUI", "TELEFON", "ADRESA"]).nullable().optional(),
});

const sectionSchema = z.object({
  name: z.string().min(1),
  order: z.number().optional().default(0),
  fields: z.array(fieldSchema).default([]),
});

const formSchema = z.object({
  icon: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  templateType: z.enum(["REQUEST_FORM", "INTERNAL_DOCUMENT", "EXTERNAL_DOCUMENT"]).default("REQUEST_FORM"),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionEn: z.string().optional(),
  completeness: z.enum(["COMPLETE", "PARTIAL"]).default("COMPLETE"),
  requiresAuth: z.boolean().default(false),
  generatesSubmissionPdf: z.boolean().default(false),
  portalSection: z.enum(["INFO", "DOCUMENTE", "PETITII", "AUDIENTE"]).nullable().optional(),
  sections: z.array(sectionSchema).default([]),
  otherFields: z.array(fieldSchema).default([]),
});

const updateFormSchema = z.object({
  icon: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  templateType: z.enum(["REQUEST_FORM", "INTERNAL_DOCUMENT", "EXTERNAL_DOCUMENT"]).optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionEn: z.string().optional(),
  completeness: z.enum(["COMPLETE", "PARTIAL"]).optional(),
  requiresAuth: z.boolean().optional(),
  generatesSubmissionPdf: z.boolean().optional(),
  portalSection: z.enum(["INFO", "DOCUMENTE", "PETITII", "AUDIENTE"]).nullable().optional(),
  sections: z.array(sectionSchema).optional(),
  otherFields: z.array(fieldSchema).optional(),
});

function fieldCreateData(f: z.infer<typeof fieldSchema>, order: number) {
  return {
    key: f.key,
    internalTitle: f.internalTitle,
    description: f.description,
    type: f.type,
    required: f.required,
    disabled: f.disabled,
    readOnly: f.readOnly,
    label: f.label,
    placeholder: f.placeholder,
    helpText: f.helpText,
    textIndicator: f.textIndicator,
    minLength: f.minLength,
    maxLength: f.maxLength,
    minValue: f.minValue,
    maxValue: f.maxValue,
    defaultValue: f.defaultValue,
    allowAiAutofill: f.allowAiAutofill,
    autofillFromProfile: f.autofillFromProfile,
    config: f.config,
    conditions: f.conditions,
    order: f.order ?? order,
    canonicalRole: f.canonicalRole,
  };
}

const formInclude = {
  sections: { include: { fields: { orderBy: { order: "asc" as const } } }, orderBy: { order: "asc" as const } },
  fields: { where: { sectionId: null }, orderBy: { order: "asc" as const } },
};

// 1) Editor de șabloane — creare șablon (formular de cerere / document intern / extern)
// cu secțiuni ("Formular") + câmpuri fără secțiune ("Alte cerințe").
formsRouter.post("/forms", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = formSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { icon, name, description, category, templateType, title, subtitle, titleEn, descriptionEn, completeness, requiresAuth, generatesSubmissionPdf, portalSection, sections, otherFields } = parsed.data;

  const form = await prisma.$transaction(async (tx) => {
    const created = await tx.form.create({
      data: { icon, name, description, category, templateType, title, subtitle, titleEn, descriptionEn, completeness, requiresAuth, generatesSubmissionPdf, portalSection },
    });

    for (const [sIdx, s] of sections.entries()) {
      const section = await tx.formSection.create({
        data: { formId: created.id, name: s.name, order: s.order ?? sIdx },
      });
      if (s.fields.length) {
        await tx.formField.createMany({
          data: s.fields.map((f, idx) => ({ formId: created.id, sectionId: section.id, ...fieldCreateData(f, idx) })),
        });
      }
    }
    if (otherFields.length) {
      await tx.formField.createMany({
        data: otherFields.map((f, idx) => ({ formId: created.id, ...fieldCreateData(f, idx) })),
      });
    }

    return tx.form.findUniqueOrThrow({ where: { id: created.id }, include: formInclude });
  });

  await logAction({ userId: req.user!.id, action: "FORM_CREATED", resource: `form:${form.id}` });
  res.status(201).json(form);
});

formsRouter.get("/forms", requireAuth, requireAdmin(), async (_req, res) => {
  const forms = await prisma.form.findMany({
    include: { ...formInclude, _count: { select: { requests: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(forms);
});

formsRouter.get("/forms/:id", requireAuth, requireAdmin(), async (req, res) => {
  const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: formInclude });
  if (!form) return res.status(404).json({ error: "Șablon inexistent" });
  res.json(form);
});

const TEMPLATE_TYPE_LABELS: Record<string, string> = {
  REQUEST_FORM: "Formular cerere",
  INTERNAL_DOCUMENT: "Document intern",
  EXTERNAL_DOCUMENT: "Document extern",
};

// Export PDF al șablonului gol — previzualizare/tipărire înainte de publicare
// (analog graficului de flux din Workflow Builder, dar pentru domeniul Form Builder).
formsRouter.get("/forms/:id/pdf", requireAuth, requireAdmin(), async (req, res) => {
  const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: formInclude });
  if (!form) return res.status(404).json({ error: "Șablon inexistent" });

  const pdfBuffer = await generateFormPdf({
    institutionName: "Agenția Națională pentru Sport",
    title: form.title || form.name,
    subtitle: form.subtitle,
    templateTypeLabel: TEMPLATE_TYPE_LABELS[form.templateType] || form.templateType,
    category: form.category,
    sections: form.sections.map((s) => ({
      name: s.name,
      fields: s.fields.map((f) => ({ label: f.label, required: f.required, helpText: f.helpText })),
    })),
    otherFields: form.fields.map((f) => ({ label: f.label, required: f.required, helpText: f.helpText })),
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${form.category}-sablon.pdf"`);
  res.send(pdfBuffer);
});

// Editare șablon — înlocuiește complet secțiunile/câmpurile (simplu, suficient pentru demo).
formsRouter.patch("/forms/:id", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const parsed = updateFormSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { icon, name, description, category, templateType, title, subtitle, titleEn, descriptionEn, completeness, requiresAuth, generatesSubmissionPdf, portalSection, sections, otherFields } = parsed.data;

  await prisma.form.update({
    where: { id: req.params.id },
    data: { icon, name, description, category, templateType, title, subtitle, titleEn, descriptionEn, completeness, requiresAuth, generatesSubmissionPdf, portalSection },
  });

  if (sections || otherFields) {
    // Ștergem secțiunile (cascadă → șterge și câmpurile din ele) + câmpurile fără secțiune, apoi recreăm.
    await prisma.formSection.deleteMany({ where: { formId: req.params.id } });
    await prisma.formField.deleteMany({ where: { formId: req.params.id, sectionId: null } });

    if (sections) {
      for (const [sIdx, s] of sections.entries()) {
        const section = await prisma.formSection.create({
          data: { formId: req.params.id, name: s.name, order: s.order ?? sIdx },
        });
        if (s.fields.length) {
          await prisma.formField.createMany({
            data: s.fields.map((f, idx) => ({ formId: req.params.id, sectionId: section.id, ...fieldCreateData(f, idx) })),
          });
        }
      }
    }
    if (otherFields) {
      await prisma.formField.createMany({
        data: otherFields.map((f, idx) => ({ formId: req.params.id, ...fieldCreateData(f, idx) })),
      });
    }
  }

  const updated = await prisma.form.findUnique({ where: { id: req.params.id }, include: formInclude });
  await logAction({ userId: req.user!.id, action: "FORM_UPDATED", resource: `form:${req.params.id}` });
  res.json(updated);
});

// Publicare instantanee — sincronizare Back-Office ↔ Portal în timp real (pct. 4, Scenariul 1).
formsRouter.post("/forms/:id/publish", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const updated = await prisma.form.update({ where: { id: req.params.id }, data: { status: "PUBLISHED" } });
  await logAction({ userId: req.user!.id, action: "FORM_PUBLISHED", resource: `form:${updated.id}` });
  res.json(updated);
});

formsRouter.post("/forms/:id/unpublish", requireAuth, requireAdmin(), async (req: AuthedRequest, res) => {
  const updated = await prisma.form.update({ where: { id: req.params.id }, data: { status: "DRAFT" } });
  await logAction({ userId: req.user!.id, action: "FORM_UNPUBLISHED", resource: `form:${updated.id}` });
  res.json(updated);
});

// 2) Portal — listă șabloane de tip "Formular cerere", publicate. Vizibile public,
// fără autentificare (Scenariul 1, pct. 5) — diferențierea de comportament are loc la
// depunere, unde un cont autentificat este legat automat de cerere.
formsRouter.get("/portal/forms", optionalAuth, async (req: AuthedRequest, res) => {
  const forms = await prisma.form.findMany({
    // Un formular marcat requiresAuth=true (4.5.1 R38) nu apare deloc pentru un vizitator
    // neautentificat — nu doar fallback-ul nume+email, ci absența completă din catalog.
    where: { status: "PUBLISHED", templateType: "REQUEST_FORM", ...(req.user ? {} : { requiresAuth: false }) },
    include: formInclude,
    orderBy: { name: "asc" },
  });
  res.json(forms);
});

const submitSchema = z.object({
  submitterName: z.string().min(1),
  submitterEmail: z.string().email(),
  data: z.record(z.any()),
});

function conditionSatisfied(condition: { field: string; operator: string; value: string }, data: Record<string, unknown>): boolean {
  const actual = String(data[condition.field] ?? "");
  if (condition.operator === "not_equals") return actual !== condition.value;
  return actual === condition.value;
}

function fieldVisible(field: { conditions: unknown }, data: Record<string, unknown>): boolean {
  const conditions = (field.conditions as { field: string; operator: string; value: string }[] | null) || [];
  return conditions.every((c) => conditionSatisfied(c, data));
}

// Randare lizibilă a unei valori depuse în PDF-ul cererii (generateSubmissionPdf) —
// array-uri (bife multiple) unite prin virgulă, boolean afișat Da/Nu, restul ca text simplu.
function formatSubmittedValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "boolean") return value ? "Da" : "Nu";
  return String(value);
}

// Depunere formular din Portal → creare automată "Cerere" în Back-Office (registratură),
// cu mapare a câmpurilor, nr. de înregistrare automat și termen legal calculat (pct. 7-9).
// Câmpurile din categoria "Sistem" (ex. Cont, Înregistrare) nu se validează ca input al
// petentului — sunt administrative și populate/activate de motorul de workflow.
// Depunerea e permisă și anonim (nume/email introduse manual); dacă petentul e
// autentificat, cererea se leagă automat de cont pentru a apărea în "Cererile mele"
// (Scenariul 1, pct. 5 — diferențiere comportament autentificat/neautentificat).
formsRouter.post("/portal/forms/:id/submit", optionalAuth, async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const form = await prisma.form.findUnique({ where: { id: req.params.id }, include: formInclude });
  if (!form || form.status !== "PUBLISHED") return res.status(404).json({ error: "Formular indisponibil" });
  if (form.requiresAuth && !req.user) return res.status(401).json({ error: "Acest serviciu necesită autentificare" });

  const { submitterName, submitterEmail, data } = parsed.data;
  const allFields = [...form.sections.flatMap((s) => s.fields), ...form.fields];
  const SYSTEM_TYPES = new Set([
    "ACCOUNT",
    "REGISTRATION",
    "REPEATABLE_GROUP",
    "NOTIFICATION_TEMPLATE",
    "NOTIFICATION_RECIPIENTS",
    "DYNAMIC_FORM_BUILDER",
    "DYNAMIC_FORM_RENDER",
    "ACCESS_DEFINITION",
  ]);

  for (const field of allFields) {
    if (SYSTEM_TYPES.has(field.type)) continue;
    const visible = fieldVisible(field, data);
    if (visible && field.required && (data[field.key] === undefined || data[field.key] === "")) {
      return res.status(400).json({ error: `Câmpul „${field.label}” este obligatoriu` });
    }
  }

  const entryRegistry = await getDefaultRegistry("INTRARE");
  const { number: registryNumber } = await issueRegistryNumber(entryRegistry.id);
  const legalDeadline = addBusinessDays(new Date(), DEFAULT_LEGAL_DEADLINE_DAYS);

  const request = await prisma.dmsRequest.create({
    data: {
      registryNumber,
      numberKind: "INTRARE",
      registryId: entryRegistry.id,
      formId: form.id,
      submitterId: req.user?.id,
      submitterName,
      submitterEmail,
      data,
      category: form.category,
      domain: form.category,
      legalDeadline,
    },
  });

  // PDF cu datele depuse (configurabil per șablon, "Configurare Portal" → generatesSubmissionPdf)
  // — nu blocăm depunerea dacă generarea eșuează, doar o logăm ca eșec izolat.
  if (form.generatesSubmissionPdf) {
    try {
      const pdfBuffer = await generateSubmissionPdf({
        institutionName: "Agenția Națională pentru Sport",
        registryNumber,
        date: new Date().toLocaleDateString("ro-RO"),
        formTitle: form.title || form.name,
        submitterName,
        submitterEmail,
        fields: allFields
          .filter((f) => !SYSTEM_TYPES.has(f.type) && fieldVisible(f, data))
          .map((f) => ({ label: f.label, value: formatSubmittedValue(data[f.key]) })),
      });
      const storagePath = newStoragePath("submission-pdfs", ".pdf");
      writeFile(storagePath, pdfBuffer);
      await prisma.document.create({
        data: {
          kind: "SUBMISSION_PDF",
          requestId: request.id,
          filename: `${registryNumber.replace(/\//g, "-")}-cerere.pdf`,
          mimeType: "application/pdf",
          sizeBytes: pdfBuffer.length,
          storagePath,
          pageCount: 1,
          uploadedById: req.user?.id,
        },
      });
    } catch (e: any) {
      await logAction({
        userId: req.user?.id,
        action: "SUBMISSION_PDF_FAILED",
        resource: `request:${request.id}`,
        metadata: { error: e?.message },
        success: false,
      });
    }
  }

  await logAction({
    userId: req.user?.id,
    action: "REQUEST_REGISTERED",
    resource: `request:${request.id}`,
    metadata: { registryNumber },
  });

  res.status(201).json(request);
});

// ------------------------------------------------------------
// "Cererile mele" — contul cetățeanului din Portal își vede propriile cereri și,
// odată semnat, răspunsul oficial (Scenariul 1, pct. 5 și 16: diferențiere cont
// autentificat + publicare răspuns în contul utilizatorului din Portal).
// ------------------------------------------------------------

formsRouter.get("/portal/my-requests", requireAuth, async (req: AuthedRequest, res) => {
  const requests = await prisma.dmsRequest.findMany({
    where: { submitterId: req.user!.id },
    select: {
      id: true,
      registryNumber: true,
      category: true,
      status: true,
      legalDeadline: true,
      registeredAt: true,
      form: { select: { name: true } },
      workflowCase: { select: { currentState: { select: { name: true, color: true } } } },
      responses: {
        where: { status: { in: ["SIGNED", "SENT"] } },
        select: { id: true, outboundNumber: true, status: true, signedAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { registeredAt: "desc" },
  });
  res.json(requests);
});

// Detaliu — verificăm explicit dreptul de proprietate (submitterId), altfel 403;
// nu expunem comentariile interne ale personalului, doar datele depuse și
// răspunsurile oficiale deja semnate/trimise (nu ciornele interne).
formsRouter.get("/portal/my-requests/:id", requireAuth, async (req: AuthedRequest, res) => {
  const request = await prisma.dmsRequest.findUnique({
    where: { id: req.params.id },
    include: {
      form: { select: { name: true, title: true } },
      workflowCase: { include: { currentState: true } },
      responses: {
        where: { status: { in: ["SIGNED", "SENT"] } },
        include: { document: { select: DOCUMENT_PUBLIC_SELECT } },
        orderBy: { createdAt: "desc" },
      },
      documents: {
        where: { kind: { in: ["ATTACHMENT", "SUBMISSION_PDF"] } },
        select: { id: true, kind: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
    },
  });
  if (!request) return res.status(404).json({ error: "Cerere inexistentă" });
  if (request.submitterId !== req.user!.id) return res.status(403).json({ error: "Această cerere nu îți aparține" });
  res.json(request);
});
