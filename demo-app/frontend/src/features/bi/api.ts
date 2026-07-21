import api from "../iam/api";

export type KpiTone = "success" | "warn" | "danger" | "info";
export interface KpiDto {
  label: string;
  value: number | string;
  tone: KpiTone;
}

export interface ComplianceDashboardDto {
  kpis: KpiDto[];
  overdueByCategory: { category: string; count: number }[];
  volumeTrend: { label: string; count: number }[];
}

export interface DocumentsDashboardDto {
  kpis: KpiDto[];
  byStatus: { status: string; count: number }[];
  byCategory: { category: string; count: number }[];
  volumeTrend: { label: string; count: number }[];
}

export interface WorkloadDashboardDto {
  kpis: KpiDto[];
  byUser: { userId: string; name: string; count: number }[];
  byGroup: { groupId: string; name: string; count: number }[];
}

export async function fetchComplianceDashboard(): Promise<ComplianceDashboardDto> {
  const { data } = await api.get("/api/bi/dashboards/compliance");
  return data;
}

export async function fetchDocumentsDashboard(): Promise<DocumentsDashboardDto> {
  const { data } = await api.get("/api/bi/dashboards/documents");
  return data;
}

export async function fetchWorkloadDashboard(): Promise<WorkloadDashboardDto> {
  const { data } = await api.get("/api/bi/dashboards/workload");
  return data;
}

export type BiChartType = "TABLE" | "BAR" | "LINE" | "PIE" | "KPI" | "FUNNEL";

export interface Nl2SqlResultDto {
  matched: boolean;
  intentKey: string | null;
  title: string;
  explanation: string;
  sqlPreview: string;
  chartType: BiChartType;
  columns: string[];
  rows: Record<string, any>[];
  params: Record<string, any>;
  suggestions?: string[];
}

export async function runNl2SqlQuery(question: string): Promise<Nl2SqlResultDto> {
  const { data } = await api.post("/api/bi/nl2sql", { question });
  return data;
}

export interface BiSavedReportDto {
  id: string;
  title: string;
  questionText?: string;
  intentKey: string;
  params?: Record<string, any>;
  chartType: BiChartType;
  createdAt: string;
  createdBy?: { id: string; name?: string; email: string };
}

export async function fetchSavedReports(): Promise<BiSavedReportDto[]> {
  const { data } = await api.get("/api/bi/reports");
  return data;
}

export async function saveReport(payload: {
  title: string;
  questionText?: string;
  intentKey: string;
  params?: Record<string, any>;
  chartType: BiChartType;
}): Promise<BiSavedReportDto> {
  const { data } = await api.post("/api/bi/reports", payload);
  return data;
}

export async function fetchSavedReportData(id: string): Promise<BiSavedReportDto & { result: Nl2SqlResultDto }> {
  const { data } = await api.get(`/api/bi/reports/${id}/data`);
  return data;
}

export async function deleteSavedReport(id: string) {
  await api.delete(`/api/bi/reports/${id}`);
}

// ------------------------------------------------------------
// Alerte pe prag — regulă simplă peste o metrică existentă, evaluată LIVE la fiecare citire.
// ------------------------------------------------------------

export type AlertOperator = "GT" | "GTE" | "LT" | "LTE";

export interface AlertMetricDto {
  key: string;
  label: string;
}

export interface BiAlertRuleDto {
  id: string;
  label: string;
  metricKey: string;
  operator: AlertOperator;
  threshold: number;
  createdAt: string;
  currentValue: number | null;
  triggered: boolean;
}

export async function fetchAlertMetrics(): Promise<AlertMetricDto[]> {
  const { data } = await api.get("/api/bi/alert-metrics");
  return data;
}

export async function fetchAlertRules(): Promise<BiAlertRuleDto[]> {
  const { data } = await api.get("/api/bi/alert-rules");
  return data;
}

export async function createAlertRule(payload: { label: string; metricKey: string; operator: AlertOperator; threshold: number }) {
  const { data } = await api.post("/api/bi/alert-rules", payload);
  return data;
}

export async function deleteAlertRule(id: string) {
  await api.delete(`/api/bi/alert-rules/${id}`);
}

// ------------------------------------------------------------
// Scoruri avansate (Efficiency/Delay/Throughput/Approval Quality) + date de sprijin
// pentru graficele Radar/Donut/Funnel/Calendar Heatmap.
// ------------------------------------------------------------

export interface ScoresDashboardDto {
  efficiency: number;
  delay: number;
  throughput: number;
  approvalQuality: number;
  throughputTrend: { label: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
  funnel: { stage: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export async function fetchScoresDashboard(): Promise<ScoresDashboardDto> {
  const { data } = await api.get("/api/bi/dashboards/scores");
  return data;
}
