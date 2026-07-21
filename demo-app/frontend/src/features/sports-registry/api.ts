import api from "../iam/api";

export type SportsOrgType = "NATIONAL_FEDERATION" | "COUNTY_ASSOCIATION" | "PROFESSIONAL_LEAGUE";
export type SportsOrgStatus = "ACTIVE" | "SUSPENDED" | "DISSOLVED" | "UNDER_INVESTIGATION";

export interface FederationDto {
  id: string;
  name: string;
  disciplineType: string;
  orgType: SportsOrgType;
  county?: string | null;
  cif?: string | null;
  address?: string | null;
  status: SportsOrgStatus;
  foundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { clubs: number; coaches: number };
  clubs?: ClubDto[];
  calendars?: CalendarVersionDto[];
}

export interface CalendarVersionDto {
  id: string;
  federationId: string;
  season: string;
  version: number;
  events: { name: string; date: string; location?: string }[];
  publishedAt: string;
}

export async function fetchFederations(): Promise<FederationDto[]> {
  const { data } = await api.get("/api/sports-registry/federations");
  return data;
}

export async function createFederation(input: { name: string; disciplineType: string; orgType: SportsOrgType; county?: string; cif?: string; address?: string }): Promise<FederationDto> {
  const { data } = await api.post("/api/sports-registry/federations", input);
  return data;
}

export async function fetchFederation(id: string): Promise<FederationDto> {
  const { data } = await api.get(`/api/sports-registry/federations/${id}`);
  return data;
}

export async function updateFederation(id: string, input: Partial<{ name: string; address: string; status: SportsOrgStatus; isMajorChange: boolean }>): Promise<FederationDto> {
  const { data } = await api.patch(`/api/sports-registry/federations/${id}`, input);
  return data;
}

export interface HistoryEntryDto {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
  isMajorChange: boolean;
  changedAt: string;
}

export async function fetchFederationHistory(id: string): Promise<HistoryEntryDto[]> {
  const { data } = await api.get(`/api/sports-registry/federations/${id}/history`);
  return data;
}

export async function publishCalendar(federationId: string, season: string, events: { name: string; date: string; location?: string }[]): Promise<CalendarVersionDto> {
  const { data } = await api.post(`/api/sports-registry/federations/${federationId}/calendar`, { season, events });
  return data;
}

// --- Cluburi ---

export interface ClubDto {
  id: string;
  name: string;
  clubType: string;
  federationId: string;
  federation?: { id: string; name: string };
  address?: string | null;
  cif?: string | null;
  status: SportsOrgStatus;
  duesUpToDate: boolean;
  foundedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { athletes: number; coaches: number };
}

export async function fetchClubs(federationId?: string): Promise<ClubDto[]> {
  const { data } = await api.get("/api/sports-registry/clubs", { params: federationId ? { federationId } : {} });
  return data;
}

export async function createClub(input: { name: string; clubType: string; federationId: string; address?: string; cif?: string }): Promise<ClubDto> {
  const { data } = await api.post("/api/sports-registry/clubs", input);
  return data;
}

export async function updateClub(id: string, input: Partial<{ name: string; address: string; status: SportsOrgStatus; isMajorChange: boolean }>): Promise<ClubDto> {
  const { data } = await api.patch(`/api/sports-registry/clubs/${id}`, input);
  return data;
}

export async function fetchClubHistory(id: string): Promise<HistoryEntryDto[]> {
  const { data } = await api.get(`/api/sports-registry/clubs/${id}/history`);
  return data;
}

export async function updateClubDues(id: string, duesUpToDate: boolean): Promise<ClubDto> {
  const { data } = await api.patch(`/api/sports-registry/clubs/${id}/dues`, { duesUpToDate });
  return data;
}

// --- Sportivi ---

export interface AthleteDto {
  id: string;
  cnp: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  clubId?: string | null;
  club?: { id: string; name: string } | null;
  medicalVisaExpiresAt?: string | null;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";
  gdprErasedAt?: string | null;
  transfers?: TransferDto[];
}

export interface TransferDto {
  id: string;
  athleteId: string;
  fromClubId?: string | null;
  toClubId: string;
  transferType: "PERMANENT" | "TEMPORARY";
  status: "PENDING" | "APPROVED" | "REJECTED";
  sourceRequestId?: string | null;
  createdAt: string;
}

export async function fetchAthletes(clubId?: string): Promise<AthleteDto[]> {
  const { data } = await api.get("/api/sports-registry/athletes", { params: clubId ? { clubId } : {} });
  return data;
}

export async function createAthlete(input: { cnp: string; firstName: string; lastName: string; clubId?: string; medicalVisaExpiresAt?: string }): Promise<AthleteDto> {
  const { data } = await api.post("/api/sports-registry/athletes", input);
  return data;
}

export async function updateAthlete(id: string, input: Partial<{ medicalVisaExpiresAt: string; clubId: string }>): Promise<AthleteDto> {
  const { data } = await api.patch(`/api/sports-registry/athletes/${id}`, input);
  return data;
}

export async function fetchAthleteEligibility(id: string): Promise<{ eligible: boolean; reasons: string[] }> {
  const { data } = await api.get(`/api/sports-registry/athletes/${id}/eligibility`);
  return data;
}

export async function importAthletesCsv(file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/sports-registry/athletes/import", form);
  return data;
}

export async function gdprEraseAthlete(id: string): Promise<AthleteDto> {
  const { data } = await api.post(`/api/sports-registry/athletes/${id}/gdpr-erase`);
  return data;
}

export async function requestTransfer(athleteId: string, toClubId: string, transferType: "PERMANENT" | "TEMPORARY") {
  const { data } = await api.post(`/api/sports-registry/athletes/${athleteId}/transfer-request`, { toClubId, transferType });
  return data;
}

// --- Antrenori ---

export interface CoachDto {
  id: string;
  cnp: string;
  firstName: string;
  lastName: string;
  certificationLevel?: string | null;
  clubId?: string | null;
  club?: { id: string; name: string } | null;
  federationId?: string | null;
  federation?: { id: string; name: string } | null;
  isEmerit: boolean;
  certifications?: { id: string; title: string; issuedAt: string }[];
}

export async function fetchCoaches(params?: { clubId?: string; federationId?: string }): Promise<CoachDto[]> {
  const { data } = await api.get("/api/sports-registry/coaches", { params });
  return data;
}

export async function createCoach(input: { cnp: string; firstName: string; lastName: string; clubId?: string; federationId?: string }): Promise<CoachDto> {
  const { data } = await api.post("/api/sports-registry/coaches", input);
  return data;
}

export async function addCoachCertification(coachId: string, title: string) {
  const { data } = await api.post(`/api/sports-registry/coaches/${coachId}/certifications`, { title });
  return data;
}

export async function requestCoachEmerit(coachId: string) {
  const { data } = await api.post(`/api/sports-registry/coaches/${coachId}/emerit-request`);
  return data;
}

// --- Baze sportive ---

export type FacilityCategory = "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7" | "B8" | "B9";
export type FacilityStatus = "ACTIVE" | "INACTIVE" | "DEMOLISHED";

export interface FacilityDto {
  id: string;
  name: string;
  category: FacilityCategory;
  county: string;
  address?: string | null;
  status: FacilityStatus;
  ownerType?: string | null;
  units: { id: string; name: string; unitType: string; capacity?: number | null }[];
}

export async function fetchFacilities(county?: string): Promise<FacilityDto[]> {
  const { data } = await api.get("/api/sports-registry/facilities", { params: county ? { county } : {} });
  return data;
}

export async function createFacility(input: { name: string; category: FacilityCategory; county: string; address?: string }): Promise<FacilityDto> {
  const { data } = await api.post("/api/sports-registry/facilities", input);
  return data;
}

export async function updateFacility(id: string, input: Partial<{ status: FacilityStatus; address: string; isMajorChange: boolean }>): Promise<FacilityDto> {
  const { data } = await api.patch(`/api/sports-registry/facilities/${id}`, input);
  return data;
}

export async function fetchFacilityHistory(id: string): Promise<HistoryEntryDto[]> {
  const { data } = await api.get(`/api/sports-registry/facilities/${id}/history`);
  return data;
}

export async function requestFacilityHomologation(id: string) {
  const { data } = await api.post(`/api/sports-registry/facilities/${id}/homologation-request`);
  return data;
}

// --- CIS ---

export interface CisCertificateDto {
  id: string;
  entityType: "FEDERATION" | "CLUB";
  entityId: string;
  certificateNumber: string;
  status: "ISSUED" | "SUSPENDED" | "REVOKED";
  issuingAuthority: "ANS" | "DJST";
  issuedAt: string;
}

export async function fetchCertificates(entityType: "FEDERATION" | "CLUB", entityId: string): Promise<CisCertificateDto[]> {
  const { data } = await api.get("/api/sports-registry/certificates", { params: { entityType, entityId } });
  return data;
}

export async function requestCis(entityType: "FEDERATION" | "CLUB", entityId: string) {
  const { data } = await api.post("/api/sports-registry/cis-request", { entityType, entityId });
  return data;
}
