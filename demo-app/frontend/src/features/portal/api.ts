import api from "../iam/api";

// --- Contul meu (4.5.1 R14-R19, R44-R48) ---

export interface AthleteResult {
  id: string;
  competitionName: string;
  date: string;
  result: string;
  medal?: string | null;
}

export interface AthleteTransfer {
  id: string;
  toClubId: string;
  transferType: "PERMANENT" | "TEMPORARY";
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface MyAthleteProfile {
  id: string;
  firstName: string;
  lastName: string;
  club?: { id: string; name: string } | null;
  medicalVisaExpiresAt?: string | null;
  results: AthleteResult[];
  transfers: AthleteTransfer[];
}

export interface MyClubProfile {
  id: string;
  name: string;
  athletes: { id: string; firstName: string; lastName: string; status: string; medicalVisaExpiresAt?: string | null }[];
}

export interface MyFederationProfile {
  id: string;
  name: string;
  clubs: { id: string; name: string; status: string; county?: string | null }[];
  calendars: { id: string; season: string; version: number; publishedAt: string }[];
}

export interface MyAccountData {
  role: string;
  linked: boolean;
  athlete?: MyAthleteProfile;
  club?: MyClubProfile;
  federation?: MyFederationProfile;
  cnfpaStats?: { coursesAuthored: number; totalEnrollments: number; totalCertificates: number };
}

export async function fetchMyAccount(): Promise<MyAccountData> {
  const { data } = await api.get("/api/portal/me");
  return data;
}

export async function updateMyContact(name: string) {
  const { data } = await api.patch("/api/portal/me/contact", { name });
  return data;
}

export interface MyRequestRow {
  id: string;
  registryNumber: string;
  category: string;
  status: string;
  createdAt: string;
  legalDeadline?: string | null;
}

export async function fetchMyRequests(): Promise<MyRequestRow[]> {
  const { data } = await api.get("/api/portal/me/requests");
  return data;
}

export async function requestTransfer(toClubId: string, transferType: "PERMANENT" | "TEMPORARY") {
  const { data } = await api.post("/api/portal/me/transfer-request", { toClubId, transferType });
  return data;
}

// --- Bibliotecă media / SPV documente reutilizabile (R46, R98) ---

export interface MediaAssetDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isPersonal: boolean;
  createdAt: string;
}

export async function uploadMediaAsset(file: File, isPersonal: boolean): Promise<MediaAssetDto> {
  const form = new FormData();
  form.append("file", file);
  form.append("isPersonal", String(isPersonal));
  const { data } = await api.post("/api/portal/media", form);
  return data;
}

export async function fetchMyMedia(): Promise<MediaAssetDto[]> {
  const { data } = await api.get("/api/portal/media", { params: { mine: "true" } });
  return data;
}

export async function fetchMediaLibrary(): Promise<MediaAssetDto[]> {
  const { data } = await api.get("/api/portal/media");
  return data;
}

// Ruta de fișier cere autentificare (SPV personal) — descărcăm ca blob (nu <a href> simplu)
// ca să trimitem Authorization, la fel ca restul fișierelor autentificate din platformă
// (vezi downloadCertificate din features/lms/api.ts).
export async function openMediaAsset(asset: MediaAssetDto) {
  const { data } = await api.get(`/api/portal/media/${asset.id}/file`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deleteMediaAsset(id: string) {
  const { data } = await api.delete(`/api/portal/media/${id}`);
  return data;
}

// --- CMS pagini publice (R59-62) ---

export interface CmsPageDto {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  titleEn?: string | null;
  bodyHtmlEn?: string | null;
  isPublished: boolean;
  updatedAt: string;
}

export async function fetchCmsPages(): Promise<CmsPageDto[]> {
  const { data } = await api.get("/api/portal/cms/pages");
  return data;
}

export async function createCmsPage(input: Partial<CmsPageDto> & { slug: string; title: string; bodyHtml: string }): Promise<CmsPageDto> {
  const { data } = await api.post("/api/portal/cms/pages", input);
  return data;
}

export async function updateCmsPage(id: string, input: Partial<CmsPageDto>): Promise<CmsPageDto> {
  const { data } = await api.patch(`/api/portal/cms/pages/${id}`, input);
  return data;
}

export async function deleteCmsPage(id: string) {
  const { data } = await api.delete(`/api/portal/cms/pages/${id}`);
  return data;
}

export async function fetchCmsPagePublic(slug: string): Promise<CmsPageDto> {
  const { data } = await api.get(`/api/portal/cms/pages/${slug}`);
  return data;
}

export async function seedMandatoryCmsPages() {
  const { data } = await api.post("/api/portal/cms/pages/seed-mandatory");
  return data;
}

// --- Șabloane email cu variabile (R88-89) ---

export interface EmailTemplateDto {
  id: string;
  key: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  updatedAt: string;
}

export async function fetchEmailTemplates(): Promise<EmailTemplateDto[]> {
  const { data } = await api.get("/api/portal/email-templates");
  return data;
}

export async function createEmailTemplate(input: Omit<EmailTemplateDto, "id" | "updatedAt">): Promise<EmailTemplateDto> {
  const { data } = await api.post("/api/portal/email-templates", input);
  return data;
}

export async function updateEmailTemplate(id: string, input: Partial<EmailTemplateDto>): Promise<EmailTemplateDto> {
  const { data } = await api.patch(`/api/portal/email-templates/${id}`, input);
  return data;
}

export async function deleteEmailTemplate(id: string) {
  const { data } = await api.delete(`/api/portal/email-templates/${id}`);
  return data;
}

export async function previewEmailTemplate(id: string, values: Record<string, string>): Promise<{ subject: string; bodyHtml: string }> {
  const { data } = await api.post(`/api/portal/email-templates/${id}/preview`, { values });
  return data;
}
