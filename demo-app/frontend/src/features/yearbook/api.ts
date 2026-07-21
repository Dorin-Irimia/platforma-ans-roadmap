import api from "../iam/api";

export type YearbookStatus = "PROVIZORIU" | "VALIDAT" | "OFICIAL";

export interface YearbookRankings {
  byFederation: { federationId: string; name: string; disciplineType: string; athleteCount: number; resultCount: number; medalCount: number }[];
  byCounty: { county: string; clubCount: number; medalCount: number }[];
  byAthlete: { athleteId: string; name: string; clubName: string | null; medalCount: number; gold: number; silver: number; bronze: number }[];
  byAgeCategory: { category: string; athleteCount: number; medalCount: number }[];
  byMedalType: { medal: string; count: number }[];
  byFacilityOwner: { ownerType: string; facilityCount: number }[];
}

export interface YearbookSnapshot {
  year: number;
  generatedAt: string;
  rankings: YearbookRankings;
}

export interface YearbookMissingWarning {
  entity: string;
  id: string;
  field: string;
}

export interface YearbookEditionDto {
  id: string;
  year: number;
  version: number;
  status: YearbookStatus;
  snapshot: YearbookSnapshot;
  missingDataWarnings: YearbookMissingWarning[];
  generatedAt: string;
  validatedAt?: string | null;
  publishedAt?: string | null;
  generatedBy?: { id: string; name?: string; email: string };
}

export async function generateYearbookEdition(year?: number): Promise<YearbookEditionDto> {
  const { data } = await api.post("/api/yearbook/yearbook/generate", year ? { year } : {});
  return data;
}

export async function fetchYearbookEditions(): Promise<YearbookEditionDto[]> {
  const { data } = await api.get("/api/yearbook/yearbook/editions");
  return data;
}

export async function updateYearbookStatus(id: string, status: "VALIDAT" | "OFICIAL", force?: boolean): Promise<YearbookEditionDto> {
  const { data } = await api.patch(`/api/yearbook/yearbook/editions/${id}/status`, { status, force });
  return data;
}

export interface YearbookPublicDto {
  latest: YearbookEditionDto | null;
  history: { id: string; year: number; version: number; publishedAt: string }[];
}

export async function fetchYearbookPublic(): Promise<YearbookPublicDto> {
  const { data } = await api.get("/api/yearbook/yearbook/public");
  return data;
}

// Rutele de export cer autentificare de personal — un <a href> simplu n-ar trimite
// Authorization, deci aducem fișierul ca blob prin axios (același tipar ca
// fetchWidgetImageBlobUrl din features/dashboard/api.ts) și declanșăm descărcarea local.
async function downloadBlob(path: string, filename: string) {
  const { data } = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadYearbookPdf(edition: YearbookEditionDto) {
  return downloadBlob(`/api/yearbook/yearbook/editions/${edition.id}/export.pdf`, `anuar-sportului-${edition.year}-v${edition.version}.pdf`);
}

export function downloadYearbookXlsx(edition: YearbookEditionDto) {
  return downloadBlob(`/api/yearbook/yearbook/editions/${edition.id}/export.xlsx`, `anuar-sportului-${edition.year}-v${edition.version}.xlsx`);
}

export interface AthleteProfileDto {
  id: string;
  name: string;
  club: string | null;
  federation: string | null;
  status: string;
  results: { competitionName: string; date: string; result: string; medal?: string | null }[];
}

export async function searchAthleteProfiles(q: string): Promise<AthleteProfileDto[]> {
  const { data } = await api.get("/api/yearbook/yearbook/athletes/search", { params: { q } });
  return data;
}
