import api from "../iam/api";

export type ChatRole = "USER" | "ASSISTANT";
export type ChatInputMethod = "TEXT" | "VOICE";

export interface ChatAttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

export type ChatSentiment = "POZITIV" | "NEUTRU" | "FRUSTRAT" | "NEGATIV";

export interface ChatMessageDto {
  id: string;
  role: ChatRole;
  content: string;
  inputMethod: ChatInputMethod;
  sourceDocIds: string[];
  sentiment?: ChatSentiment | null;
  createdAt: string;
  attachments: ChatAttachmentDto[];
}

export interface ChatConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

export interface ChatConversationDetail extends ChatConversationSummary {
  messages: ChatMessageDto[];
}

export async function fetchConversations(q?: string): Promise<ChatConversationSummary[]> {
  const { data } = await api.get("/api/chatbot/conversations", { params: q ? { q } : {} });
  return data;
}

export async function createConversation(title?: string): Promise<ChatConversationSummary> {
  const { data } = await api.post("/api/chatbot/conversations", { title });
  return data;
}

export async function fetchConversation(id: string): Promise<ChatConversationDetail> {
  const { data } = await api.get(`/api/chatbot/conversations/${id}`);
  return data;
}

export async function renameConversation(id: string, title: string) {
  const { data } = await api.patch(`/api/chatbot/conversations/${id}`, { title });
  return data as ChatConversationSummary;
}

export async function deleteConversation(id: string) {
  await api.delete(`/api/chatbot/conversations/${id}`);
}

export async function sendMessage(
  conversationId: string,
  input: { content: string; inputMethod: ChatInputMethod; files?: File[] }
): Promise<{ userMessage: ChatMessageDto; assistantMessage: ChatMessageDto }> {
  const form = new FormData();
  form.append("content", input.content);
  form.append("inputMethod", input.inputMethod);
  (input.files || []).forEach((f) => form.append("files", f));
  const { data } = await api.post(`/api/chatbot/conversations/${conversationId}/messages`, form);
  return data;
}

export async function fetchAttachmentBlobUrl(id: string): Promise<string> {
  const { data } = await api.get(`/api/chatbot/attachments/${id}/file`, { responseType: "blob" });
  return URL.createObjectURL(data);
}

export interface ChatTemplateAvailableDto {
  id: string;
  name: string;
  category: string;
  variables: string[];
  requiredAttachments: string[];
}

export async function fetchAvailableTemplates(): Promise<ChatTemplateAvailableDto[]> {
  const { data } = await api.get("/api/chatbot/templates/available");
  return data;
}

export async function generateDocument(conversationId: string, templateId: string, values: Record<string, string>): Promise<ChatMessageDto> {
  const { data } = await api.post(`/api/chatbot/conversations/${conversationId}/generate-document`, { templateId, values });
  return data;
}

export async function previewDocument(conversationId: string, templateId: string, values: Record<string, string>): Promise<{ title: string; renderedBody: string }> {
  const { data } = await api.post(`/api/chatbot/conversations/${conversationId}/generate-document/preview`, { templateId, values });
  return data;
}

// --- Admin: bază de cunoștințe ---

export interface ChatKnowledgeDocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  extractedText?: string | null;
  createdAt: string;
}

export async function fetchKnowledgeDocuments(): Promise<ChatKnowledgeDocumentDto[]> {
  const { data } = await api.get("/api/chatbot/documents");
  return data;
}

export async function uploadKnowledgeDocuments(files: File[]): Promise<ChatKnowledgeDocumentDto[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await api.post("/api/chatbot/documents", form);
  return data;
}

export async function deleteKnowledgeDocument(id: string) {
  await api.delete(`/api/chatbot/documents/${id}`);
}

// --- Admin: șabloane de documente ---

export interface ChatTemplateDto {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  requiredAttachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatTemplateInput {
  name: string;
  category: string;
  body: string;
  variables: string[];
  requiredAttachments: string[];
}

export async function fetchTemplates(): Promise<ChatTemplateDto[]> {
  const { data } = await api.get("/api/chatbot/templates");
  return data;
}

export async function createTemplate(input: ChatTemplateInput): Promise<ChatTemplateDto> {
  const { data } = await api.post("/api/chatbot/templates", input);
  return data;
}

export async function updateTemplate(id: string, input: Partial<ChatTemplateInput>): Promise<ChatTemplateDto> {
  const { data } = await api.patch(`/api/chatbot/templates/${id}`, input);
  return data;
}

export async function deleteTemplate(id: string) {
  await api.delete(`/api/chatbot/templates/${id}`);
}

// --- Admin: registru de variabile (reutilizabil între șabloane) ---

export interface ChatVariableDto {
  id: string;
  key: string;
  label: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchChatVariables(): Promise<ChatVariableDto[]> {
  const { data } = await api.get("/api/chatbot/variables");
  return data;
}

export async function createChatVariable(input: { key: string; label: string; description?: string }): Promise<ChatVariableDto> {
  const { data } = await api.post("/api/chatbot/variables", input);
  return data;
}

export async function deleteChatVariable(id: string) {
  await api.delete(`/api/chatbot/variables/${id}`);
}

// ------------------------------------------------------------
// Automatizări — escaladare pe cuvinte-cheie către intervenție umană.
// ------------------------------------------------------------

export interface ChatbotSettingsDto {
  escalationKeywords: string[];
}

export async function fetchChatbotSettings(): Promise<ChatbotSettingsDto> {
  const { data } = await api.get("/api/chatbot/settings");
  return data;
}

export async function updateChatbotSettings(escalationKeywords: string[]): Promise<ChatbotSettingsDto> {
  const { data } = await api.patch("/api/chatbot/settings", { escalationKeywords });
  return data;
}

export interface ConversationNeedingReviewDto {
  id: string;
  title: string;
  needsReviewReason?: string | null;
  updatedAt: string;
  user: { id: string; name?: string; email: string };
  _count: { messages: number };
}

export async function fetchConversationsNeedingReview(): Promise<ConversationNeedingReviewDto[]> {
  const { data } = await api.get("/api/chatbot/conversations/needs-review");
  return data;
}

export async function resolveConversationReview(id: string) {
  const { data } = await api.patch(`/api/chatbot/conversations/${id}/resolve-review`);
  return data;
}
