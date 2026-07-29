import { Router } from "express";
import multer from "multer";
import path from "path";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../iam/rbac.middleware";
import { logAction } from "../iam/audit.service";
import { newStoragePath, writeFile, readFile } from "../../shared/storage";

export const dashboardRouter = Router();

// Imaginile butoanelor custom (mici, per-utilizator) trec prin memorie, la fel ca
// atașamentele din DMS — vezi documents.routes.ts pentru justificare.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });

const WIDGET_TYPES = ["RECENT_REQUESTS", "ACCOUNT_SUMMARY", "CHART", "SAVED_REPORT", "LINK_BUTTON", "CUSTOM_BUTTON", "STATS", "ACTIVITY_LOG", "AUTOMATION_SUMMARY", "LMS_CONTINUE_LEARNING"] as const;

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];
// Roluri de stakeholder extern (Portal Public, 4.5.1) — conturi SPORTIV/FEDERATIE/CLUB/CNFPA,
// distincte de UTILIZATOR_STANDARD (cetățean generic fără entitate de domeniu asociată).
const STAKEHOLDER_ROLES = ["SPORTIV", "FEDERATIE", "CLUB", "CNFPA"];

// Panoul principal e complet configurabil — niciun conținut static — dar un cont nou nu
// trebuie să vadă o pagină goală, deci la prima vizită (0 widget-uri) se creează automat
// un aranjament implicit, diferențiat pe rol. Utilizatorul rămâne complet liber să le
// mute/redimensioneze/șteargă imediat după — sunt widget-uri normale, nu ceva special.
async function seedDefaultWidgets(userId: string, role: string) {
  const isStaff = STAFF_ROLES.includes(role);
  const isStakeholder = STAKEHOLDER_ROLES.includes(role);
  const defaults = isStaff
    ? [
        { type: "STATS" as const, x: 0, y: 0, w: 12, h: 3 },
        { type: "ACTIVITY_LOG" as const, title: "Activitate recentă", x: 0, y: 3, w: 7, h: 6 },
        { type: "RECENT_REQUESTS" as const, title: "Cereri recente", config: { limit: 6 }, x: 7, y: 3, w: 5, h: 6 },
        { type: "LINK_BUTTON" as const, title: "Registratură", config: { url: "/registratura", icon: "document" }, x: 0, y: 9, w: 3, h: 2 },
        { type: "LINK_BUTTON" as const, title: "Editor șabloane", config: { url: "/form-builder", icon: "document" }, x: 3, y: 9, w: 3, h: 2 },
        { type: "LINK_BUTTON" as const, title: "Business Intelligence", config: { url: "/bi", icon: "globe" }, x: 6, y: 9, w: 3, h: 2 },
        { type: "LINK_BUTTON" as const, title: "Utilizatori", config: { url: "/admin", icon: "institution" }, x: 9, y: 9, w: 3, h: 2 },
        { type: "LMS_CONTINUE_LEARNING" as const, title: "Continuă parcurgerea", x: 0, y: 11, w: 6, h: 6 },
      ]
    : isStakeholder
    ? [
        { type: "ACCOUNT_SUMMARY" as const, x: 0, y: 0, w: 4, h: 5 },
        { type: "LINK_BUTTON" as const, title: "Contul meu", config: { url: "/contul-meu", icon: "document" }, x: 4, y: 0, w: 4, h: 2 },
        ...(role === "CNFPA" ? [{ type: "LINK_BUTTON" as const, title: "Cursuri CNFPA", config: { url: "/lms", icon: "globe" }, x: 8, y: 0, w: 4, h: 2 }] : []),
        { type: "LMS_CONTINUE_LEARNING" as const, title: "Continuă parcurgerea", x: 0, y: 5, w: 6, h: 6 },
      ]
    : [
        { type: "ACCOUNT_SUMMARY" as const, x: 0, y: 0, w: 4, h: 5 },
        { type: "RECENT_REQUESTS" as const, title: "Cererile mele", config: { limit: 6 }, x: 4, y: 0, w: 8, h: 5 },
        { type: "LMS_CONTINUE_LEARNING" as const, title: "Continuă parcurgerea", x: 0, y: 5, w: 6, h: 6 },
      ];

  await prisma.dashboardWidget.createMany({
    data: defaults.map((d) => ({
      userId,
      type: d.type,
      title: "title" in d ? d.title : undefined,
      config: "config" in d ? (d.config as any) : undefined,
      x: d.x,
      y: d.y,
      w: d.w,
      h: d.h,
    })),
  });
}

const widgetBodySchema = z.object({
  type: z.enum(WIDGET_TYPES).optional(),
  title: z.string().trim().max(120).optional(),
  config: z.string().optional(), // JSON.stringify pe client, parsat mai jos
  x: z.coerce.number().int().min(0).optional(),
  y: z.coerce.number().int().min(0).optional(),
  w: z.coerce.number().int().min(1).max(12).optional(),
  h: z.coerce.number().int().min(1).max(12).optional(),
});

function parseConfig(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

dashboardRouter.get("/widgets", requireAuth, async (req: AuthedRequest, res) => {
  const count = await prisma.dashboardWidget.count({ where: { userId: req.user!.id } });
  if (count === 0) await seedDefaultWidgets(req.user!.id, req.user!.role);

  const widgets = await prisma.dashboardWidget.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "asc" },
  });
  res.json(widgets);
});

dashboardRouter.post("/widgets", requireAuth, upload.single("image"), async (req: AuthedRequest, res) => {
  const parsed = widgetBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Date invalide", details: parsed.error.issues });
  if (!parsed.data.type) return res.status(400).json({ error: "Tip widget lipsă" });

  let imageStoragePath: string | undefined;
  let imageMimeType: string | undefined;
  if (req.file) {
    const ext = path.extname(req.file.originalname) || "";
    imageStoragePath = newStoragePath("widget-images", ext);
    writeFile(imageStoragePath, req.file.buffer);
    imageMimeType = req.file.mimetype;
  }

  const widget = await prisma.dashboardWidget.create({
    data: {
      userId: req.user!.id,
      type: parsed.data.type,
      title: parsed.data.title,
      config: parseConfig(parsed.data.config) as any,
      imageStoragePath,
      imageMimeType,
      x: parsed.data.x ?? 0,
      y: parsed.data.y ?? 0,
      w: parsed.data.w ?? 4,
      h: parsed.data.h ?? 3,
    },
  });

  await logAction({ userId: req.user!.id, action: "WIDGET_CREATED", resource: `widget:${widget.id}`, metadata: { type: widget.type } });
  res.status(201).json(widget);
});

dashboardRouter.patch("/widgets/:id", requireAuth, upload.single("image"), async (req: AuthedRequest, res) => {
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.id } });
  if (!widget || widget.userId !== req.user!.id) return res.status(404).json({ error: "Modul inexistent" });

  const parsed = widgetBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Date invalide", details: parsed.error.issues });

  let imageStoragePath = widget.imageStoragePath;
  let imageMimeType = widget.imageMimeType;
  if (req.file) {
    const ext = path.extname(req.file.originalname) || "";
    imageStoragePath = newStoragePath("widget-images", ext);
    writeFile(imageStoragePath, req.file.buffer);
    imageMimeType = req.file.mimetype;
  }

  const updated = await prisma.dashboardWidget.update({
    where: { id: widget.id },
    data: {
      type: parsed.data.type ?? widget.type,
      title: parsed.data.title ?? widget.title,
      config: (parsed.data.config !== undefined ? parseConfig(parsed.data.config) : widget.config ?? undefined) as any,
      imageStoragePath,
      imageMimeType,
      x: parsed.data.x ?? widget.x,
      y: parsed.data.y ?? widget.y,
      w: parsed.data.w ?? widget.w,
      h: parsed.data.h ?? widget.h,
    },
  });

  res.json(updated);
});

dashboardRouter.delete("/widgets/:id", requireAuth, async (req: AuthedRequest, res) => {
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.id } });
  if (!widget || widget.userId !== req.user!.id) return res.status(404).json({ error: "Modul inexistent" });

  await prisma.dashboardWidget.delete({ where: { id: widget.id } });
  await logAction({ userId: req.user!.id, action: "WIDGET_DELETED", resource: `widget:${widget.id}`, metadata: { type: widget.type } });
  res.json({ deleted: true });
});

const layoutSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      x: z.coerce.number().int().min(0),
      y: z.coerce.number().int().min(0),
      w: z.coerce.number().int().min(1).max(12),
      h: z.coerce.number().int().min(1).max(12),
    })
  ),
});

// Actualizare în bloc după o sesiune de drag/resize — evită N cereri individuale
// la fiecare mișcare din react-grid-layout.
dashboardRouter.put("/widgets/layout", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = layoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Date invalide", details: parsed.error.issues });

  const owned = await prisma.dashboardWidget.findMany({
    where: { userId: req.user!.id, id: { in: parsed.data.items.map((i) => i.id) } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((w) => w.id));

  await prisma.$transaction(
    parsed.data.items
      .filter((item) => ownedIds.has(item.id))
      .map((item) =>
        prisma.dashboardWidget.update({
          where: { id: item.id },
          data: { x: item.x, y: item.y, w: item.w, h: item.h },
        })
      )
  );

  res.json({ updated: true });
});

dashboardRouter.get("/widgets/:id/image", requireAuth, async (req: AuthedRequest, res) => {
  const widget = await prisma.dashboardWidget.findUnique({ where: { id: req.params.id } });
  if (!widget || widget.userId !== req.user!.id) return res.status(404).json({ error: "Modul inexistent" });
  if (!widget.imageStoragePath) return res.status(404).json({ error: "Fără imagine" });

  const buffer = readFile(widget.imageStoragePath);
  res.setHeader("Content-Type", widget.imageMimeType || "application/octet-stream");
  res.send(buffer);
});

// Agregă toate regulile automate adăugate în platformă (câte o regulă per modul),
// pentru widget-ul AUTOMATION_SUMMARY — un singur loc din care se vede dintr-o
// privire ce a semnalat/acționat fiecare modul, fără să navighezi în fiecare în parte.
dashboardRouter.get("/automation-summary", requireAuth, requireRole("SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"), async (_req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [authPolicy, chatbotNeedsReview, monthNoShows, archiveSettings, lmsSettings, sportsSettings, biRules, overdueRequests] = await Promise.all([
    prisma.authPolicySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.chatConversation.count({ where: { needsReview: true } }),
    prisma.museumVisit.count({ where: { noShow: true, visitDate: { gte: startOfMonth } } }),
    prisma.archiveSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.lmsAssistantSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.sportsRegistrySettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.biAlertRule.findMany(),
    prisma.dmsRequest.count({ where: { status: { in: ["NOU", "IN_LUCRU", "IN_ASTEPTARE"] }, legalDeadline: { lt: now } } }),
  ]);

  const pendingExpiryMs = authPolicy.pendingApprovalExpiryDays * 86_400_000;
  const pendingTooLong = await prisma.user.count({
    where: { isActive: false, pendingApprovalSince: { not: null, lt: new Date(Date.now() - pendingExpiryMs) } },
  });

  const stalledFolders = await prisma.archiveFolder.count({
    where: { stage: { not: "ARCHIVED" }, updatedAt: { lt: new Date(Date.now() - archiveSettings.stalledAfterDays * 86_400_000) } },
  });
  const stalledEnrollments = await prisma.lmsEnrollment.count({
    where: { progressPercent: { lt: 100 }, updatedAt: { lt: new Date(Date.now() - lmsSettings.stalledAfterDays * 86_400_000) } },
  });
  const suspendedClubsDues = await prisma.sportsClub.count({ where: { status: "SUSPENDED", duesMarkedOverdueAt: { not: null } } });

  const { ALERT_METRICS, evaluateOperator } = await import("../bi/alertMetrics");
  let biAlertsTriggered = 0;
  for (const rule of biRules) {
    const metric = ALERT_METRICS[rule.metricKey];
    if (!metric) continue;
    const value = await metric.fn();
    if (value !== null && evaluateOperator(value, rule.operator, rule.threshold)) biAlertsTriggered++;
  }

  res.json([
    { module: "Registratură", label: "Cereri cu termen depășit", count: overdueRequests, tone: overdueRequests > 0 ? "danger" : "success", link: "/registratura" },
    { module: "Utilizatori", label: "Conturi în așteptare expirate", count: pendingTooLong, tone: pendingTooLong > 0 ? "warn" : "success", link: "/admin" },
    { module: "Business Intelligence", label: "Alerte declanșate", count: biAlertsTriggered, tone: biAlertsTriggered > 0 ? "danger" : "success", link: "/bi" },
    { module: "Chatbot", label: "Conversații ce necesită intervenție", count: chatbotNeedsReview, tone: chatbotNeedsReview > 0 ? "warn" : "success", link: "/chatbot" },
    { module: "Cursuri", label: "Înscrieri stagnante", count: stalledEnrollments, tone: stalledEnrollments > 0 ? "warn" : "success", link: "/lms" },
    { module: "Registru Sportiv", label: "Cluburi suspendate (taxe)", count: suspendedClubsDues, tone: suspendedClubsDues > 0 ? "warn" : "success", link: "/registru-sportiv" },
    { module: "Muzeu", label: "Neprezentări luna aceasta", count: monthNoShows, tone: "info", link: "/muzeu" },
    { module: "Arhivă", label: "Dosare stagnante", count: stalledFolders, tone: stalledFolders > 0 ? "warn" : "success", link: "/arhiva" },
  ]);
});
