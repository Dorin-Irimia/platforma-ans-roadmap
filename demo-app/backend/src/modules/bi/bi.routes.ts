// Modul BI — Scenariul 2: dashboard-uri analitice reale (calculate din DmsRequest/User,
// nu date simulate) + interogare NL2SQL + rapoarte salvate reutilizabile.
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../shared/prisma";
import { requireAuth, AuthedRequest } from "../iam/rbac.middleware";
import { requireStaff } from "./rbac";
import {
  overdueCount,
  nearDueCount,
  backlogCount,
  totalRequests,
  overdueBreakdown,
  volumeTrendByMonth,
  countByStatus,
  countByCategory,
  workloadByUser,
  workloadByGroup,
  staffUserCount,
  unassignedCount,
  avgResolutionDays,
} from "./metrics";
import { runNl2Sql } from "./nl2sql";
import { ALERT_METRICS, evaluateOperator } from "./alertMetrics";
import { efficiencyScore, delayScore, throughputScore, throughputByMonth, approvalQualityScore, dailyVolumeThisYear, statusFunnel } from "./scores";

export const biRouter = Router();

// Dashboard 4 — Scoruri avansate (cerință 4.5.12: Efficiency/Delay/Throughput/Approval
// Quality) + date de sprijin pentru graficele Radar/Donut/Funnel/Calendar Heatmap.
biRouter.get("/dashboards/scores", requireAuth, requireStaff(), async (_req, res) => {
  const [efficiency, delay, throughput, approvalQuality, throughputTrend, dailyVolume, funnel, byStatus] = await Promise.all([
    efficiencyScore(),
    delayScore(),
    throughputScore(),
    approvalQualityScore(),
    throughputByMonth(6),
    dailyVolumeThisYear(),
    statusFunnel(),
    countByStatus(),
  ]);
  res.json({ efficiency, delay, throughput, approvalQuality, throughputTrend, dailyVolume, funnel, byStatus });
});

// Dashboard 1 — Conformitate / Termene: câte cereri active sunt depășite, aproape de
// termen sau în grafic, plus breakdown pe categorie și trendul de volum al ultimelor luni.
biRouter.get("/dashboards/compliance", requireAuth, requireStaff(), async (_req, res) => {
  const [overdue, nearDue, backlog, breakdown, trend] = await Promise.all([
    overdueCount(),
    nearDueCount(),
    backlogCount(),
    overdueBreakdown("category"),
    volumeTrendByMonth(6),
  ]);
  res.json({
    kpis: [
      { label: "Cereri depășite", value: overdue, tone: overdue > 0 ? "danger" : "success" },
      { label: "Aproape de termen (≤3 zile)", value: nearDue, tone: nearDue > 0 ? "warn" : "success" },
      { label: "Total în lucru (backlog)", value: backlog, tone: "info" },
      { label: "În grafic (nedepășite)", value: Math.max(backlog - overdue, 0), tone: "success" },
    ],
    overdueByCategory: breakdown,
    volumeTrend: trend,
  });
});

// Dashboard 2 — Flux/volum documente: distribuție pe status, pe categorie, trend lunar.
biRouter.get("/dashboards/documents", requireAuth, requireStaff(), async (_req, res) => {
  const [total, byStatus, byCategory, trend] = await Promise.all([
    totalRequests(),
    countByStatus(),
    countByCategory(),
    volumeTrendByMonth(6),
  ]);
  const thisMonth = trend[trend.length - 1]?.count ?? 0;
  res.json({
    kpis: [
      { label: "Total cereri", value: total, tone: "info" },
      { label: "Înregistrate luna curentă", value: thisMonth, tone: "info" },
      { label: "Categorii distincte", value: byCategory.length, tone: "info" },
    ],
    byStatus,
    byCategory,
    volumeTrend: trend,
  });
});

// Dashboard 3 — Volum de lucru: alocare pe utilizator/grup, backlog nealocat, timp mediu.
biRouter.get("/dashboards/workload", requireAuth, requireStaff(), async (_req, res) => {
  const [staffCount, unassigned, backlog, byUser, byGroup, avgDays] = await Promise.all([
    staffUserCount(),
    unassignedCount(),
    backlogCount(),
    workloadByUser(),
    workloadByGroup(),
    avgResolutionDays(),
  ]);
  res.json({
    kpis: [
      { label: "Personal activ", value: staffCount, tone: "info" },
      { label: "Cereri nealocate", value: unassigned, tone: unassigned > 0 ? "warn" : "success" },
      { label: "Backlog total", value: backlog, tone: "info" },
      { label: "Timp mediu soluționare (zile, aprox.)", value: avgDays ?? "—", tone: "info" },
    ],
    byUser,
    byGroup,
  });
});

// NL2SQL — interogare în limbaj natural (română) → intenție potrivită dintr-o
// bibliotecă fixă (nu execuție de SQL arbitrar generat de un LLM, ca să evităm orice
// risc de injecție) → interogare Prisma reală + un string SQL echivalent afișat pentru
// transparența mecanismului (cerință explicită: „acceptă variante semi-automate, cu
// explicarea mecanismului").
const nlQuerySchema = z.object({ question: z.string().min(3) });

biRouter.post("/nl2sql", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = nlQuerySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const result = await runNl2Sql(parsed.data.question);
  res.json(result);
});

// Rapoarte salvate — persistă "rețeta" interogării (intentKey + parametri), nu un
// instantaneu static; la afișare se re-rulează interogarea pentru date curente.
const saveReportSchema = z.object({
  title: z.string().min(1),
  questionText: z.string().optional(),
  intentKey: z.string().min(1),
  params: z.record(z.any()).optional(),
  chartType: z.enum(["TABLE", "BAR", "LINE", "PIE", "KPI", "DONUT", "RADAR", "FUNNEL"]).default("TABLE"),
});

biRouter.post("/reports", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = saveReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const report = await prisma.biSavedReport.create({ data: { ...parsed.data, createdById: req.user!.id } });
  res.status(201).json(report);
});

biRouter.get("/reports", requireAuth, requireStaff(), async (_req, res) => {
  const reports = await prisma.biSavedReport.findMany({
    include: { createdBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(reports);
});

// Redă un raport salvat cu date LIVE — re-rulează intenția NL2SQL originală cu
// parametrii salvați, nu returnează un rezultat înghețat la momentul salvării.
biRouter.get("/reports/:id/data", requireAuth, requireStaff(), async (req, res) => {
  const report = await prisma.biSavedReport.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: "Raport inexistent" });
  const result = await runNl2Sql(report.questionText || "", { forceIntent: report.intentKey, params: (report.params as Record<string, any>) || {} });
  res.json({ ...report, result });
});

biRouter.delete("/reports/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  await prisma.biSavedReport.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

// ------------------------------------------------------------
// Alerte pe prag — regulă simplă peste o metrică existentă (vezi alertMetrics.ts),
// evaluată leneș la deschiderea paginii BI (fără scheduler în acest demo).
// ------------------------------------------------------------

biRouter.get("/alert-metrics", requireAuth, requireStaff(), async (_req, res) => {
  res.json(Object.entries(ALERT_METRICS).map(([key, m]) => ({ key, label: m.label })));
});

const alertRuleSchema = z.object({
  label: z.string().min(1),
  metricKey: z.string().refine((k) => k in ALERT_METRICS, "Metrică necunoscută"),
  operator: z.enum(["GT", "GTE", "LT", "LTE"]),
  threshold: z.number().int(),
});

biRouter.post("/alert-rules", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  const parsed = alertRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const rule = await prisma.biAlertRule.create({ data: { ...parsed.data, createdById: req.user!.id } });
  res.status(201).json(rule);
});

// Listă + evaluare LIVE — fiecare regulă e recalculată la fiecare citire, nu stocată.
biRouter.get("/alert-rules", requireAuth, requireStaff(), async (_req, res) => {
  const rules = await prisma.biAlertRule.findMany({ orderBy: { createdAt: "desc" } });
  const evaluated = await Promise.all(
    rules.map(async (rule) => {
      const metric = ALERT_METRICS[rule.metricKey];
      const value = metric ? await metric.fn() : null;
      const triggered = value !== null && evaluateOperator(value, rule.operator, rule.threshold);
      return { ...rule, currentValue: value, triggered };
    })
  );
  res.json(evaluated);
});

biRouter.delete("/alert-rules/:id", requireAuth, requireStaff(), async (req: AuthedRequest, res) => {
  await prisma.biAlertRule.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
