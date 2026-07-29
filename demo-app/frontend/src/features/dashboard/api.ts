import api from "../iam/api";

export type DashboardWidgetType =
  | "RECENT_REQUESTS"
  | "ACCOUNT_SUMMARY"
  | "CHART"
  | "SAVED_REPORT"
  | "LINK_BUTTON"
  | "CUSTOM_BUTTON"
  | "STATS"
  | "ACTIVITY_LOG"
  | "AUTOMATION_SUMMARY"
  | "LMS_CONTINUE_LEARNING";

export interface DashboardWidgetDto {
  id: string;
  userId: string;
  type: DashboardWidgetType;
  title?: string | null;
  config?: Record<string, unknown> | null;
  imageStoragePath?: string | null;
  imageMimeType?: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  createdAt: string;
  updatedAt: string;
}

export interface WidgetFormInput {
  type?: DashboardWidgetType;
  title?: string;
  config?: Record<string, unknown>;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  image?: File | null;
}

function toFormData(input: WidgetFormInput): FormData {
  const form = new FormData();
  if (input.type) form.append("type", input.type);
  if (input.title !== undefined) form.append("title", input.title);
  if (input.config !== undefined) form.append("config", JSON.stringify(input.config));
  if (input.x !== undefined) form.append("x", String(input.x));
  if (input.y !== undefined) form.append("y", String(input.y));
  if (input.w !== undefined) form.append("w", String(input.w));
  if (input.h !== undefined) form.append("h", String(input.h));
  if (input.image) form.append("image", input.image);
  return form;
}

export async function fetchWidgets(): Promise<DashboardWidgetDto[]> {
  const { data } = await api.get("/api/dashboard/widgets");
  return data;
}

export async function createWidget(input: WidgetFormInput): Promise<DashboardWidgetDto> {
  const { data } = await api.post("/api/dashboard/widgets", toFormData(input));
  return data;
}

export async function updateWidget(id: string, input: WidgetFormInput): Promise<DashboardWidgetDto> {
  const { data } = await api.patch(`/api/dashboard/widgets/${id}`, toFormData(input));
  return data;
}

export async function deleteWidget(id: string) {
  await api.delete(`/api/dashboard/widgets/${id}`);
}

export async function updateLayout(items: { id: string; x: number; y: number; w: number; h: number }[]) {
  await api.put("/api/dashboard/widgets/layout", { items });
}

// Imaginea e servită printr-o rută autentificată (izolare per-utilizator), deci un
// <img src> simplu n-ar trimite Authorization — aducem fișierul ca blob prin axios
// (același tipar ca fetchDocumentBlob din features/dms/api.ts) și construim un object URL.
export async function fetchWidgetImageBlobUrl(id: string): Promise<string> {
  const { data } = await api.get(`/api/dashboard/widgets/${id}/image`, { responseType: "blob" });
  return URL.createObjectURL(data);
}

export interface AutomationSummaryItemDto {
  module: string;
  label: string;
  count: number;
  tone: "success" | "warn" | "danger" | "info";
  link: string;
}

export async function fetchAutomationSummary(): Promise<AutomationSummaryItemDto[]> {
  const { data } = await api.get("/api/dashboard/automation-summary");
  return data;
}
