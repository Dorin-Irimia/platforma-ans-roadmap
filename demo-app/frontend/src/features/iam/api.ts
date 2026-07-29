import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000" });

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export interface LoginResponse {
  token?: string;
  requiresTwoFactor?: boolean;
  methods?: ("totp" | "email")[];
  user?: { id: string; email: string; role: string };
}

export async function login(email: string, password: string, totpCode?: string, emailOtpCode?: string) {
  const { data } = await api.post<LoginResponse>("/api/iam/login", { email, password, totpCode, emailOtpCode });
  return data;
}

// Conector real RoEID (OIDC, redirect complet de pagină — nu un apel API obișnuit).
// eIDAS și RoEID duc la același endpoint: RoEID e schema românească notificată la Comisia
// Europeană ca mijloc eIDAS, nu există un conector eIDAS separat pentru cetățenii români.
export function startRoeidLogin() {
  window.location.href = `${api.defaults.baseURL}/api/iam/login/roeid/start`;
}

export async function register(email: string, password: string, name?: string) {
  const { data } = await api.post("/api/iam/register", { email, password, name });
  return data as { id: string; email: string; role: string; pendingApproval: boolean };
}

// Trimite un link Supabase de recuperare parolă pe email — vezi ForgotPasswordPage.tsx
// (cere linkul) și ResetPasswordPage.tsx (setează parola nouă, după click pe link).
export async function requestPasswordReset(email: string) {
  const { data } = await api.post("/api/iam/password-reset/request", { email });
  return data as { message: string };
}

export interface Me {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  isActive: boolean;
  language?: string;
  hasAvatar?: boolean;
}

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get("/api/iam/me");
  return data;
}

// --- Setări cont (autoservire) ---

export async function updateMe(input: { name?: string; language?: string }): Promise<Me> {
  const { data } = await api.patch("/api/iam/me", input);
  return data;
}

export async function uploadAvatar(file: File): Promise<Me> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/iam/me/avatar", form);
  return data;
}

export async function deleteAvatar(): Promise<Me> {
  const { data } = await api.delete("/api/iam/me/avatar");
  return data;
}

// Ruta cere autentificare — nu poate fi folosită direct ca `<img src>` (fără antetul
// Authorization); încărcăm ca blob și expunem un object URL, la fel ca la certificate/media.
export async function fetchAvatarBlobUrl(userId: string): Promise<string | null> {
  try {
    const { data } = await api.get(`/api/iam/users/${userId}/avatar`, { responseType: "blob" });
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post("/api/iam/me/change-password", { currentPassword, newPassword });
}

export interface UserVariableDto {
  id: string;
  key: string;
  label: string;
  value: string;
  createdAt: string;
}

export async function fetchMyVariables(): Promise<UserVariableDto[]> {
  const { data } = await api.get("/api/iam/me/variables");
  return data;
}

export async function createVariable(input: { key: string; label: string; value: string }): Promise<UserVariableDto> {
  const { data } = await api.post("/api/iam/me/variables", input);
  return data;
}

export async function updateVariable(id: string, input: { label?: string; value?: string }): Promise<UserVariableDto> {
  const { data } = await api.patch(`/api/iam/me/variables/${id}`, input);
  return data;
}

export async function deleteVariable(id: string): Promise<void> {
  await api.delete(`/api/iam/me/variables/${id}`);
}

export async function fetchUsers() {
  const { data } = await api.get("/api/iam/users");
  return data;
}

export async function inviteEmployee(email: string, name: string | undefined, role: string) {
  const { data } = await api.post("/api/iam/users/invite", { email, name, role });
  return data as { id: string; email: string; role: string };
}

export async function deleteUser(id: string) {
  await api.delete(`/api/iam/users/${id}`);
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLog(filters: AuditFilters = {}) {
  const { data } = await api.get("/api/iam/audit", { params: filters });
  return data;
}

export async function setUserActive(id: string, isActive: boolean) {
  const { data } = await api.patch(`/api/iam/users/${id}/active`, { isActive });
  return data;
}

export async function setUserRole(id: string, role: string) {
  const { data } = await api.patch(`/api/iam/users/${id}/role`, { role });
  return data;
}

// --- Legătură cont ↔ entitate de domeniu (4.5.1 R14-R16, conturi SPORTIV/CLUB/FEDERATIE) ---

export interface LinkableEntity {
  id: string;
  label: string;
}

export async function fetchLinkableEntities(entityType: "ATHLETE" | "CLUB" | "FEDERATION"): Promise<LinkableEntity[]> {
  const { data } = await api.get("/api/iam/users/linkable-entities", { params: { entityType } });
  return data;
}

export async function linkUserEntity(userId: string, entityType: "ATHLETE" | "CLUB" | "FEDERATION", entityId: string | null) {
  const { data } = await api.patch(`/api/iam/users/${userId}/link-entity`, { entityType, entityId });
  return data;
}

// --- 2FA (TOTP prin Supabase MFA) ---

export async function enroll2FA() {
  const { data } = await api.post<{ factorId: string; qrCodeSvg: string; secret: string }>("/api/iam/2fa/enroll");
  return data;
}

export async function verify2FA(factorId: string, code: string) {
  const { data } = await api.post("/api/iam/2fa/verify", { factorId, code });
  return data;
}

export async function disable2FA(factorId: string) {
  const { data } = await api.post("/api/iam/2fa/disable", { factorId });
  return data;
}

export interface TotpFactor {
  id: string;
  status: string;
  friendly_name?: string;
}

export async function fetch2FAFactors() {
  const { data } = await api.get<{ factors: TotpFactor[] }>("/api/iam/2fa/factors");
  return data.factors;
}

// --- 2FA (Email OTP) — al doilea canal, complet local ---

export async function fetchEmailOtpStatus() {
  const { data } = await api.get<{ enabled: boolean }>("/api/iam/2fa-email/status");
  return data.enabled;
}

export async function enrollEmailOtp() {
  const { data } = await api.post<{ enabled: boolean }>("/api/iam/2fa-email/enroll");
  return data.enabled;
}

export async function disableEmailOtp() {
  const { data } = await api.post<{ enabled: boolean }>("/api/iam/2fa-email/disable");
  return data.enabled;
}

export async function requestEmailOtp(email: string, password: string) {
  const { data } = await api.post<{ sent: boolean; devCode: string }>("/api/iam/2fa-email/request", { email, password });
  return data;
}

// --- Politică de autentificare ---

export interface AuthPolicy {
  sessionMinutes: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  pendingApprovalExpiryDays: number;
}

export async function rejectExpiredPending(): Promise<{ rejected: number }> {
  const { data } = await api.post("/api/iam/users/reject-expired-pending");
  return data;
}

export async function fetchAuthPolicy(): Promise<AuthPolicy> {
  const { data } = await api.get("/api/iam/auth-policy");
  return data;
}

export async function updateAuthPolicy(policy: AuthPolicy): Promise<AuthPolicy> {
  const { data } = await api.patch("/api/iam/auth-policy", policy);
  return data;
}

// --- Grupuri ---

export interface GroupMember {
  user: { id: string; email: string; name?: string };
}

export interface GroupRow {
  id: string;
  name: string;
  members: GroupMember[];
}

export async function fetchGroups(): Promise<GroupRow[]> {
  const { data } = await api.get("/api/iam/groups");
  return data;
}

export async function createGroup(name: string): Promise<GroupRow> {
  const { data } = await api.post("/api/iam/groups", { name });
  return data;
}

export async function deleteGroup(id: string) {
  await api.delete(`/api/iam/groups/${id}`);
}

export async function addGroupMember(groupId: string, userId: string) {
  await api.post(`/api/iam/groups/${groupId}/members`, { userId });
}

export async function removeGroupMember(groupId: string, userId: string) {
  await api.delete(`/api/iam/groups/${groupId}/members/${userId}`);
}

// --- Secret Manager ---

export interface SecretRow {
  key: string;
  updatedAt: string;
}

export async function fetchSecrets(): Promise<SecretRow[]> {
  const { data } = await api.get("/api/iam/secrets");
  return data;
}

export async function setSecret(key: string, value: string) {
  const { data } = await api.post("/api/iam/secrets", { key, value });
  return data;
}

export async function downloadSecretK8sManifest(key: string) {
  const { data } = await api.get(`/api/iam/secrets/${key}/k8s-manifest`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${key}-secret.yaml`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Sesiuni active + revocare per-dispozitiv ---

export interface SessionRow {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  lastSeenAt: string;
  isCurrent?: boolean;
}

export async function fetchMySessions(): Promise<SessionRow[]> {
  const { data } = await api.get("/api/iam/sessions");
  return data;
}

export async function revokeMySession(id: string) {
  const { data } = await api.delete(`/api/iam/sessions/${id}`);
  return data;
}

export async function fetchUserSessions(userId: string): Promise<SessionRow[]> {
  const { data } = await api.get(`/api/iam/users/${userId}/sessions`);
  return data;
}

export async function revokeUserSession(userId: string, sessionId: string) {
  const { data } = await api.delete(`/api/iam/users/${userId}/sessions/${sessionId}`);
  return data;
}

export default api;
