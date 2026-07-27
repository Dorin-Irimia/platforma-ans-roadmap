import api from "../iam/api";
import { FieldType, ConditionRule, CanonicalRole } from "./fieldCatalog";

export type { FieldType };
export type TemplateType = "REQUEST_FORM" | "INTERNAL_DOCUMENT" | "EXTERNAL_DOCUMENT";

export interface FormFieldDef {
  id?: string;
  key: string;
  internalTitle: string;
  description?: string;
  type: FieldType;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  label: string;
  placeholder?: string;
  helpText?: string;
  textIndicator?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
  allowAiAutofill: boolean;
  // Precompletare din profilul utilizatorului autentificat (4.5.1 R40) — distinct de
  // autocompletarea AI de mai sus.
  autofillFromProfile?: boolean;
  config?: Record<string, unknown>;
  conditions?: ConditionRule[];
  order?: number;
  canonicalRole?: CanonicalRole | null;
}

export interface FormSectionDef {
  id?: string;
  name: string;
  order?: number;
  fields: FormFieldDef[];
}

export type ServiceCompleteness = "COMPLETE" | "PARTIAL";
export type PortalSection = "INFO" | "DOCUMENTE" | "PETITII" | "AUDIENTE";

export interface FormDef {
  id: string;
  icon: string;
  name: string;
  description?: string;
  category: string;
  templateType: TemplateType;
  title?: string;
  subtitle?: string;
  titleEn?: string | null;
  descriptionEn?: string | null;
  status: "DRAFT" | "PUBLISHED";
  // Serviciu Electronic Complet vs. Parțial (4.5.1 R35).
  completeness: ServiceCompleteness;
  // Dacă true, formularul nu apare pe /portal pentru un vizitator neautentificat (R38).
  requiresAuth: boolean;
  // Dacă true, la depunere se generează automat un PDF cu datele completate, atașat
  // cererii — vizibil/descărcabil de petent din "Cererile mele" și de personal din
  // Registratură.
  generatesSubmissionPdf: boolean;
  // Secțiunea de catalog public (4.5.1 R37) — null pentru șabloanele non-publice.
  portalSection?: PortalSection | null;
  sections: FormSectionDef[];
  fields: FormFieldDef[]; // "Alte cerințe" — fără secțiune
  createdAt: string;
}

export interface FormPayload {
  icon: string;
  name: string;
  description?: string;
  category: string;
  templateType: TemplateType;
  title?: string;
  subtitle?: string;
  titleEn?: string;
  descriptionEn?: string;
  completeness?: ServiceCompleteness;
  requiresAuth?: boolean;
  generatesSubmissionPdf?: boolean;
  portalSection?: PortalSection | null;
  sections: FormSectionDef[];
  otherFields: FormFieldDef[];
}

export async function fetchForms(): Promise<FormDef[]> {
  const { data } = await api.get("/api/dms/forms");
  return data;
}

export async function createForm(payload: FormPayload) {
  const { data } = await api.post("/api/dms/forms", payload);
  return data as FormDef;
}

export async function updateForm(id: string, payload: Partial<FormPayload>) {
  const { data } = await api.patch(`/api/dms/forms/${id}`, payload);
  return data as FormDef;
}

export async function publishForm(id: string) {
  const { data } = await api.post(`/api/dms/forms/${id}/publish`);
  return data;
}

export async function unpublishForm(id: string) {
  const { data } = await api.post(`/api/dms/forms/${id}/unpublish`);
  return data;
}

// Export PDF al șablonului gol — descărcare directă (analog downloadSecretK8sManifest).
export async function downloadFormPdf(id: string, filename: string) {
  const { data } = await api.get(`/api/dms/forms/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchPortalForms(): Promise<FormDef[]> {
  const { data } = await api.get("/api/dms/portal/forms");
  return data;
}

export async function submitForm(formId: string, payload: { submitterName: string; submitterEmail: string; data: Record<string, unknown> }) {
  const { data } = await api.post(`/api/dms/portal/forms/${formId}/submit`, payload);
  return data;
}

// ------------------------------------------------------------
// "Cererile mele" — contul cetățeanului din Portal (necesită autentificare)
// ------------------------------------------------------------

export interface MyRequestSummary {
  id: string;
  registryNumber: string;
  category: string;
  status: string;
  legalDeadline?: string;
  registeredAt: string;
  form?: { name: string };
  workflowCase?: { currentState: { name: string; color: string } } | null;
  responses: { id: string; outboundNumber?: string; status: string; signedAt?: string }[];
}

export async function fetchMyRequests(): Promise<MyRequestSummary[]> {
  const { data } = await api.get("/api/dms/portal/my-requests");
  return data;
}

export interface MyRequestDetail {
  id: string;
  registryNumber: string;
  category: string;
  status: string;
  legalDeadline?: string;
  registeredAt: string;
  form?: { name: string; title?: string };
  workflowCase?: { currentState: WorkflowStateDto } | null;
  responses: { id: string; body: string; outboundNumber?: string; status: string; createdAt: string; document?: DocumentDto }[];
  documents: { id: string; kind: "ATTACHMENT" | "SUBMISSION_PDF"; filename: string; mimeType: string; sizeBytes: number; createdAt: string }[];
}

export async function fetchMyRequestDetail(id: string): Promise<MyRequestDetail> {
  const { data } = await api.get(`/api/dms/portal/my-requests/${id}`);
  return data;
}

export interface DmsRequestSummary {
  id: string;
  registryNumber: string;
  numberKind: "INTRARE" | "INTERN";
  submitterName: string;
  submitterEmail: string;
  category: string;
  domain?: string;
  status: string;
  legalDeadline?: string;
  registeredAt: string;
  tags?: string[];
  locked?: boolean;
  archived?: boolean;
  form?: { name: string; category: string };
  assignedTo?: { id: string; name?: string; email: string } | null;
  assignedGroup?: { id: string; name: string } | null;
  workflowCase?: { id: string; currentState: WorkflowStateDto } | null;
  responses: { outboundNumber?: string | null; status: string; signedAt?: string | null }[];
}

export interface RequestFilters {
  status?: string;
  category?: string;
  numberKind?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  q?: string;
}

export async function fetchRequests(filtersOrStatus?: string | RequestFilters): Promise<DmsRequestSummary[]> {
  const params = typeof filtersOrStatus === "string" ? { status: filtersOrStatus } : filtersOrStatus || {};
  const { data } = await api.get("/api/dms/requests", { params });
  return data;
}

export async function exportRequestsXlsx(filters: RequestFilters) {
  const { data } = await api.get("/api/dms/requests/export.xlsx", { params: filters, responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "registratura.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importRequests(file: File): Promise<{ imported: number; errors: string[] }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/dms/requests/import", form);
  return data;
}

// ------------------------------------------------------------
// Motor de workflow pe stări+tranziții (model URBIO Workflow Builder)
// ------------------------------------------------------------

export type StateCategory = "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
export type WorkflowVisibility = "PRIVATE" | "PUBLIC";
export type WorkflowSection =
  | "COMPLAINTS"
  | "DOC_ISSUANCE"
  | "EVENTS"
  | "GENERAL"
  | "OFFICIAL_GAZETTE"
  | "PUBLIC_INFO"
  | "PUBLIC_CONSULTATION"
  | "REPORTS"
  | "SURVEYS"
  | "POLLS";
export type DueDateUnit = "MINUTES" | "HOURS" | "BUSINESS_DAYS" | "MONTHS" | "YEARS";
export type ReminderChannel = "PUSH" | "EMAIL";
export type ValidationType = "VALIDATE_TEMPLATE" | "VALIDATE_FIELD" | "VALIDATE_UNIQUENESS" | "MANUAL_CHECKLIST" | "VALIDATE_SIGNATURE";
export type ActionType =
  | "SEND_EMAIL"
  | "SEND_NOTIFICATION"
  | "GENERATE_DOCUMENT"
  | "ASSIGN_TO_USER"
  | "ASSIGN_TO_GROUP"
  | "SET_DUE_DATE"
  | "REQUEST_SIGNATURE"
  | "PUBLISH_TO_PORTAL"
  | "CREATE_CALENDAR_EVENT"
  | "ADD_TAG"
  | "LOCK_REQUEST"
  | "ARCHIVE_REQUEST";
export type TriggerType = "RESPONSE_THRESHOLD" | "DURATION_IN_STATE" | "DEADLINE_OVERDUE";

export interface WorkflowStateDto {
  id: string;
  name: string;
  category: StateCategory;
  color: string;
  description?: string;
}

export interface WorkflowReminderDto {
  id?: string;
  channel: ReminderChannel;
  quantity: number;
  unit: DueDateUnit;
}

export interface WorkflowTransitionTemplateDto {
  id?: string;
  formId: string;
  required: boolean;
  form?: { id: string; name: string; templateType: TemplateType };
}

export interface WorkflowValidationDto {
  id?: string;
  type: ValidationType;
  config?: Record<string, unknown>;
  order?: number;
}

export interface WorkflowActionDto {
  id?: string;
  type: ActionType;
  config?: Record<string, unknown>;
  order?: number;
}

export interface WorkflowTriggerDto {
  id?: string;
  type: TriggerType;
  config?: Record<string, unknown>;
}

export interface WorkflowTransitionDto {
  id: string;
  workflowDefId: string;
  name: string;
  fromStateId: string | null;
  toStateId: string;
  fromState?: WorkflowStateDto | null;
  toState?: WorkflowStateDto;
  requiresComment: boolean;
  requiresApproval: boolean;
  notifySubmitter: boolean;
  order: number;
  templates: WorkflowTransitionTemplateDto[];
  validations: WorkflowValidationDto[];
  actions: WorkflowActionDto[];
  triggers: WorkflowTriggerDto[];
}

export interface WorkflowDefDto {
  id: string;
  icon: string;
  name: string;
  description?: string;
  visibility: WorkflowVisibility;
  section: WorkflowSection;
  tags: string[];
  category: string;
  dueDateQuantity?: number;
  dueDateUnit?: DueDateUnit;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  reminders: WorkflowReminderDto[];
  transitions?: WorkflowTransitionDto[];
  transitionCount?: number;
}

export interface WorkflowCaseEventDto {
  id: string;
  fromState?: WorkflowStateDto | null;
  toState: WorkflowStateDto;
  performedBy?: { id: string; name?: string; email: string } | null;
  comment?: string;
  createdAt: string;
  transition?: { id: string; name: string } | null;
}

export interface WorkflowCaseDto {
  id: string;
  requestId: string;
  workflowDefId: string;
  workflowDef?: WorkflowDefDto;
  currentStateId: string;
  currentState: WorkflowStateDto;
  enteredStateAt: string;
  dueAt?: string | null;
  events?: WorkflowCaseEventDto[];
}

export async function fetchWorkflowStates(): Promise<WorkflowStateDto[]> {
  const { data } = await api.get("/api/dms/workflow-states");
  return data;
}

export async function createWorkflowState(payload: { name: string; category: StateCategory; color: string; description?: string }) {
  const { data } = await api.post("/api/dms/workflow-states", payload);
  return data as WorkflowStateDto;
}

export async function updateWorkflowState(id: string, payload: Partial<{ name: string; category: StateCategory; color: string; description: string }>) {
  const { data } = await api.patch(`/api/dms/workflow-states/${id}`, payload);
  return data as WorkflowStateDto;
}

export async function deleteWorkflowState(id: string) {
  await api.delete(`/api/dms/workflow-states/${id}`);
}

export interface WorkflowGroupDto {
  id: string;
  name: string;
}

export async function fetchWorkflowGroups(): Promise<WorkflowGroupDto[]> {
  const { data } = await api.get("/api/dms/workflow-groups");
  return data;
}

export async function createWorkflowGroup(name: string) {
  const { data } = await api.post("/api/dms/workflow-groups", { name });
  return data as WorkflowGroupDto;
}

export async function fetchWorkflowDefs(): Promise<WorkflowDefDto[]> {
  const { data } = await api.get("/api/dms/workflow-defs");
  return data;
}

export async function fetchWorkflowDef(id: string): Promise<WorkflowDefDto> {
  const { data } = await api.get(`/api/dms/workflow-defs/${id}`);
  return data;
}

export type WorkflowDefPayload = Omit<WorkflowDefDto, "id" | "createdAt" | "updatedAt" | "transitions" | "transitionCount">;

export async function createWorkflowDef(payload: Partial<WorkflowDefPayload>) {
  const { data } = await api.post("/api/dms/workflow-defs", payload);
  return data as WorkflowDefDto;
}

export async function updateWorkflowDef(id: string, payload: Partial<WorkflowDefPayload>) {
  const { data } = await api.patch(`/api/dms/workflow-defs/${id}`, payload);
  return data as WorkflowDefDto;
}

export async function toggleWorkflowDefActive(id: string, isActive: boolean) {
  const { data } = await api.patch(`/api/dms/workflow-defs/${id}/active`, { isActive });
  return data as WorkflowDefDto;
}

export async function duplicateWorkflowDef(id: string) {
  const { data } = await api.post(`/api/dms/workflow-defs/${id}/duplicate`);
  return data as WorkflowDefDto;
}

export async function deleteWorkflowDef(id: string) {
  await api.delete(`/api/dms/workflow-defs/${id}`);
}

export type WorkflowTransitionPayload = Omit<WorkflowTransitionDto, "id" | "workflowDefId" | "fromState" | "toState">;

export async function createWorkflowTransition(workflowDefId: string, payload: Partial<WorkflowTransitionPayload>) {
  const { data } = await api.post(`/api/dms/workflow-defs/${workflowDefId}/transitions`, payload);
  return data as WorkflowTransitionDto;
}

export async function updateWorkflowTransition(id: string, payload: Partial<WorkflowTransitionPayload>) {
  const { data } = await api.patch(`/api/dms/workflow-transitions/${id}`, payload);
  return data as WorkflowTransitionDto;
}

export async function deleteWorkflowTransition(id: string) {
  await api.delete(`/api/dms/workflow-transitions/${id}`);
}

// Motor de execuție caz — tranzițiile disponibile pentru cererea curentă (fie tranziții
// de START dacă nu are încă un caz, fie tranzițiile din starea curentă a cazului).
export async function fetchCaseTransitions(requestId: string): Promise<{ case: WorkflowCaseDto | null; availableTransitions: WorkflowTransitionDto[] }> {
  const { data } = await api.get(`/api/dms/requests/${requestId}/workflow/transitions`);
  return data;
}

export async function initiateWorkflowCase(requestId: string, payload: { transitionId: string; comment?: string; checklistConfirmations?: string[] }) {
  const { data } = await api.post(`/api/dms/requests/${requestId}/workflow/initiate`, payload);
  return data as WorkflowCaseDto;
}

export async function advanceWorkflowCase(requestId: string, payload: { transitionId: string; comment?: string; checklistConfirmations?: string[] }) {
  const { data } = await api.post(`/api/dms/requests/${requestId}/workflow/advance`, payload);
  return data as WorkflowCaseDto;
}

export interface DocumentDto {
  id: string;
  kind: "ATTACHMENT" | "GENERATED_RESPONSE" | "SIGNED_RESPONSE" | "SUBMISSION_PDF";
  filename: string;
  mimeType: string;
  sizeBytes: number;
  pageCount?: number;
  createdAt: string;
  uploadedBy?: { id: string; email: string; name?: string };
  signaturePlacements?: SignaturePlacementDto[];
}

export interface SignaturePlacementDto {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export interface DmsRequestDetail extends DmsRequestSummary {
  data: Record<string, unknown>;
  form?: FormDef;
  comments: { id: string; body: string; mentions: string[]; createdAt: string; author: { id: string; email: string; name?: string } }[];
  responses: { id: string; body: string; status: string; outboundNumber?: string; signedAt?: string; createdAt: string; document?: DocumentDto }[];
  documents: DocumentDto[]; // atașamente
  workflowCase?: WorkflowCaseDto | null;
}

export async function fetchRequestDetail(id: string): Promise<DmsRequestDetail> {
  const { data } = await api.get(`/api/dms/requests/${id}`);
  return data;
}

export async function updateRequest(id: string, payload: Partial<{ category: string; domain: string; status: string; suspendDays: number; suspendReason: string }>) {
  const { data } = await api.patch(`/api/dms/requests/${id}`, payload);
  return data;
}

export async function addComment(requestId: string, body: string) {
  const { data } = await api.post(`/api/dms/requests/${requestId}/comments`, { body });
  return data;
}

export type OutboundNumberMode = "SAME_AS_ENTRY" | "FROM_REGISTRY";

export interface ResponseTemplateDto {
  id: string;
  name: string;
  category: string;
  body: string;
  outboundMode: OutboundNumberMode;
  outboundRegistryId?: string | null;
  outboundRegistry?: { id: string; name: string; code: string } | null;
}

export async function fetchTemplates(): Promise<ResponseTemplateDto[]> {
  const { data } = await api.get("/api/dms/response-templates");
  return data;
}

export async function createTemplate(payload: { name: string; category: string; body: string; outboundMode?: OutboundNumberMode; outboundRegistryId?: string | null }) {
  const { data } = await api.post("/api/dms/response-templates", payload);
  return data;
}

export async function updateTemplateNumbering(id: string, payload: { outboundMode?: OutboundNumberMode; outboundRegistryId?: string | null }) {
  const { data } = await api.patch(`/api/dms/response-templates/${id}`, payload);
  return data;
}

// ------------------------------------------------------------
// Registre de numerotare (intrare/intern/ieșire) — configurabile din Registratură.
// ------------------------------------------------------------

export type RegistryKind = "INTRARE" | "INTERN" | "IESIRE";

export interface NumberingRegistryDto {
  id: string;
  name: string;
  code: string;
  kind: RegistryKind;
  startNumber: number;
  isDefault: boolean;
  currentYearLastNumber: number | null;
  createdAt: string;
}

export async function fetchRegistries(): Promise<NumberingRegistryDto[]> {
  const { data } = await api.get("/api/dms/registries");
  return data;
}

export async function createRegistry(payload: { name: string; code: string; kind: RegistryKind; startNumber: number; isDefault?: boolean }) {
  const { data } = await api.post("/api/dms/registries", payload);
  return data;
}

export async function updateRegistry(id: string, payload: Partial<{ name: string; startNumber: number; isDefault: boolean }>) {
  const { data } = await api.patch(`/api/dms/registries/${id}`, payload);
  return data;
}

export async function generateResponse(requestId: string, templateId: string) {
  const { data } = await api.post(`/api/dms/requests/${requestId}/responses`, { templateId });
  return data;
}

export async function signResponse(responseId: string) {
  const { data } = await api.post(`/api/dms/responses/${responseId}/sign`);
  return data;
}

export async function sendResponse(responseId: string) {
  const { data } = await api.post(`/api/dms/responses/${responseId}/send`);
  return data;
}

export interface SignaturePlacementInput {
  page: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export async function createSignaturePlacement(responseId: string, placement: SignaturePlacementInput) {
  const { data } = await api.post(`/api/dms/responses/${responseId}/signature-placement`, placement);
  return data as SignaturePlacementDto;
}

export async function uploadAttachments(requestId: string, files: File[]): Promise<DocumentDto[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  // Nu seta manual Content-Type: axios/browser trebuie să genereze singur boundary-ul
  // multipart; suprascriindu-l cu un string fix, requestul devine imposibil de parsat pe server.
  const { data } = await api.post(`/api/dms/requests/${requestId}/attachments`, form);
  return data;
}

export async function deleteAttachment(documentId: string) {
  const { data } = await api.delete(`/api/dms/documents/${documentId}`);
  return data;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";

// URL brut al fișierului — folosit de <PdfPreview> (react-pdf), care are nevoie
// să seteze el însuși antetul Authorization la fetch (vezi httpHeaders mai jos).
export function documentFileUrl(documentId: string): string {
  return `${API_BASE}/api/dms/documents/${documentId}/file`;
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("ans_demo_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Descărcare/deschidere fișier — navigarea directă (<a href>) nu trimite antetul
// Authorization, deci aducem fișierul ca blob prin axios (care are deja tokenul
// setat implicit) și deschidem/descărcăm din memorie.
export async function fetchDocumentBlob(documentId: string): Promise<Blob> {
  const { data } = await api.get(`/api/dms/documents/${documentId}/file`, { responseType: "blob" });
  return data;
}

// ------------------------------------------------------------
// Modul Arhivă — organizare/indexare/căutare pe documente deja digitale
// ------------------------------------------------------------

export type ArchiveFolderStage = "INTAKE" | "GROUPED" | "BOUND" | "INVENTORIED" | "DIGITIZED" | "INDEXED" | "ARCHIVED";

export interface ArchiveFolderDto {
  id: string;
  name: string;
  stalled?: boolean;
  stage: ArchiveFolderStage;
  indexFields: { label: string; value: string }[];
  createdAt: string;
  updatedAt: string;
  _count?: { documents: number };
  documents?: { id: string; filename: string; mimeType: string; sizeBytes: number; createdAt: string }[];
}

export async function fetchArchiveFolders(): Promise<ArchiveFolderDto[]> {
  const { data } = await api.get("/api/dms/archive/folders");
  return data;
}

export async function createArchiveFolder(input: { name: string; indexFields: { label: string; value: string }[] }): Promise<ArchiveFolderDto> {
  const { data } = await api.post("/api/dms/archive/folders", input);
  return data;
}

export async function fetchArchiveFolder(id: string): Promise<ArchiveFolderDto> {
  const { data } = await api.get(`/api/dms/archive/folders/${id}`);
  return data;
}

export async function updateArchiveFolder(id: string, input: Partial<{ name: string; stage: ArchiveFolderStage; indexFields: { label: string; value: string }[] }>): Promise<ArchiveFolderDto> {
  const { data } = await api.patch(`/api/dms/archive/folders/${id}`, input);
  return data;
}

export async function assignDocumentsToFolder(folderId: string, documentIds: string[]) {
  const { data } = await api.post(`/api/dms/archive/folders/${folderId}/documents`, { documentIds });
  return data;
}

export async function searchArchive(q: string) {
  const { data } = await api.get("/api/dms/archive/search", { params: { q } });
  return data as { id: string; filename: string; mimeType: string; archiveFolder?: { id: string; name: string } }[];
}
