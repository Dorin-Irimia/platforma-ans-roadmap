import { prisma } from "../../shared/prisma";

// Log generic de istoric — reutilizat pentru FEDERATION/CLUB/FACILITY (schimbare
// sediu/denumire, dezactivare) în loc de tabele aproape identice per entitate.
// Compară doar câmpurile indicate în `fields` și scrie câte o intrare per câmp schimbat.
export async function logHistoryDiff(
  entityType: "FEDERATION" | "CLUB" | "FACILITY",
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
  isMajorChange: boolean
) {
  const entries = fields
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      entityType,
      entityId,
      field,
      oldValue: before[field] != null ? String(before[field]) : null,
      newValue: after[field] != null ? String(after[field]) : null,
      isMajorChange,
    }));
  if (entries.length === 0) return;
  await prisma.orgHistoryEntry.createMany({ data: entries });
}
