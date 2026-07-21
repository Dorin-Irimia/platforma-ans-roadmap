import api from "../iam/api";

export type NomenclatorFieldType = "TEXT" | "NUMBER" | "DATE";

export interface NomenclatorFieldDef {
  key: string;
  label: string;
  type: NomenclatorFieldType;
}

export interface NomenclatorEntryDto {
  id: string;
  nomenclatorId: string;
  values: Record<string, unknown>;
  createdAt: string;
}

export interface NomenclatorDto {
  id: string;
  name: string;
  description?: string | null;
  fields: NomenclatorFieldDef[];
  createdAt: string;
  updatedAt: string;
  _count?: { entries: number };
  entries?: NomenclatorEntryDto[];
}

export async function fetchNomenclatoare(): Promise<NomenclatorDto[]> {
  const { data } = await api.get("/api/dms/nomenclatoare");
  return data;
}

export async function fetchNomenclator(id: string): Promise<NomenclatorDto> {
  const { data } = await api.get(`/api/dms/nomenclatoare/${id}`);
  return data;
}

export async function createNomenclator(input: { name: string; description?: string; fields: NomenclatorFieldDef[] }): Promise<NomenclatorDto> {
  const { data } = await api.post("/api/dms/nomenclatoare", input);
  return data;
}

export async function updateNomenclator(id: string, input: Partial<{ name: string; description: string; fields: NomenclatorFieldDef[] }>): Promise<NomenclatorDto> {
  const { data } = await api.patch(`/api/dms/nomenclatoare/${id}`, input);
  return data;
}

export async function deleteNomenclator(id: string) {
  await api.delete(`/api/dms/nomenclatoare/${id}`);
}

export async function createNomenclatorEntry(nomenclatorId: string, values: Record<string, unknown>): Promise<NomenclatorEntryDto> {
  const { data } = await api.post(`/api/dms/nomenclatoare/${nomenclatorId}/entries`, { values });
  return data;
}

export async function updateNomenclatorEntry(nomenclatorId: string, entryId: string, values: Record<string, unknown>): Promise<NomenclatorEntryDto> {
  const { data } = await api.patch(`/api/dms/nomenclatoare/${nomenclatorId}/entries/${entryId}`, { values });
  return data;
}

export async function deleteNomenclatorEntry(nomenclatorId: string, entryId: string) {
  await api.delete(`/api/dms/nomenclatoare/${nomenclatorId}/entries/${entryId}`);
}

export async function importNomenclatorEntries(nomenclatorId: string, file: File): Promise<{ imported: number }> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post(`/api/dms/nomenclatoare/${nomenclatorId}/import`, form);
  return data;
}

export async function exportNomenclator(nomenclator: NomenclatorDto) {
  const { data } = await api.get(`/api/dms/nomenclatoare/${nomenclator.id}/export.xlsx`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomenclator.name}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------
// Legătura nomenclator ↔ formular (Form Builder + Portal).
// ------------------------------------------------------------

export interface FormNomenclatorLinkDto {
  id: string;
  formId: string;
  nomenclatorId: string;
  fieldMapping: Record<string, string>; // {nomenclatorFieldKey: formFieldKey}
  nomenclator?: NomenclatorDto;
}

export async function fetchFormNomenclatorLinks(formId: string): Promise<FormNomenclatorLinkDto[]> {
  const { data } = await api.get(`/api/dms/forms/${formId}/nomenclator-links`);
  return data;
}

export async function linkNomenclatorToForm(formId: string, nomenclatorId: string, fieldMapping: Record<string, string>): Promise<FormNomenclatorLinkDto> {
  const { data } = await api.post(`/api/dms/forms/${formId}/nomenclator-links`, { nomenclatorId, fieldMapping });
  return data;
}

export async function unlinkNomenclatorFromForm(formId: string, linkId: string) {
  await api.delete(`/api/dms/forms/${formId}/nomenclator-links/${linkId}`);
}
