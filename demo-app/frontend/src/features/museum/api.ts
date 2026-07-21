import api from "../iam/api";

export interface MuseumSettingsDto {
  maxCapacityPerSlot: number;
  ticketPriceRon: number;
}

export async function fetchMuseumSettings(): Promise<MuseumSettingsDto> {
  const { data } = await api.get("/api/museum/settings");
  return data;
}

export interface MuseumArtifactDto {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  isFragile: boolean;
  photoStoragePath?: string | null;
  createdAt: string;
}

export async function fetchArtifacts(): Promise<MuseumArtifactDto[]> {
  const { data } = await api.get("/api/museum/artifacts");
  return data;
}

export async function createArtifact(input: { name: string; description?: string; category: string; isFragile: boolean; photo?: File | null }): Promise<MuseumArtifactDto> {
  const form = new FormData();
  form.append("name", input.name);
  if (input.description) form.append("description", input.description);
  form.append("category", input.category);
  form.append("isFragile", String(input.isFragile));
  if (input.photo) form.append("photo", input.photo);
  const { data } = await api.post("/api/museum/artifacts", form);
  return data;
}

export async function deleteArtifact(id: string) {
  await api.delete(`/api/museum/artifacts/${id}`);
}

export function artifactPhotoUrl(id: string): string {
  const base = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";
  return `${base}/api/museum/artifacts/${id}/photo`;
}

export interface MuseumVisitDto {
  id: string;
  visitorName: string;
  visitorEmail: string;
  ticketCode: string;
  visitDate: string;
  timeSlot: string;
  peopleCount: number;
  priceTotal: number;
  checkedInAt?: string | null;
  noShow: boolean;
  createdAt: string;
  qrCodeDataUrl?: string;
}

export async function bookVisit(input: { visitorName: string; visitorEmail: string; visitDate: string; timeSlot: string; peopleCount: number }): Promise<MuseumVisitDto> {
  const { data } = await api.post("/api/museum/visits", input);
  return data;
}

export async function fetchVisit(ticketCode: string): Promise<MuseumVisitDto> {
  const { data } = await api.get(`/api/museum/visits/${ticketCode}`);
  return data;
}

export async function fetchVisits(visitDate?: string): Promise<MuseumVisitDto[]> {
  const { data } = await api.get("/api/museum/visits", { params: visitDate ? { visitDate } : {} });
  return data;
}

export async function checkInVisit(ticketCode: string): Promise<MuseumVisitDto> {
  const { data } = await api.post(`/api/museum/visits/${ticketCode}/checkin`);
  return data;
}
