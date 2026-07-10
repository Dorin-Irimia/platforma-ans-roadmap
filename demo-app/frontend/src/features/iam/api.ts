import axios from "axios";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000" });

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  else delete api.defaults.headers.common["Authorization"];
}

export interface LoginResponse {
  token?: string;
  requiresTwoFactor?: boolean;
  user?: { id: string; email: string; role: string };
}

export async function login(email: string, password: string, twoFactorToken?: string) {
  const { data } = await api.post<LoginResponse>("/api/iam/login", { email, password, twoFactorToken });
  return data;
}

export async function register(email: string, password: string, name?: string) {
  const { data } = await api.post("/api/iam/register", { email, password, name });
  return data;
}

export async function fetchUsers() {
  const { data } = await api.get("/api/iam/users");
  return data;
}

export async function fetchAuditLog() {
  const { data } = await api.get("/api/iam/audit");
  return data;
}

export async function setUserActive(id: string, isActive: boolean) {
  const { data } = await api.patch(`/api/iam/users/${id}/active`, { isActive });
  return data;
}

export default api;
