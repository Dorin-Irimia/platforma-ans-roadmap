// Calcul termene — Registratura Electronică + Motorul de Workflow trebuie
// să calculeze automat termenele, excluzând zilele nelucrătoare (cerință explicită
// din Scenariul 1, pct. 11: "calcul automat termene (excluzând zile nelucrătoare)").

export function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay(); // 0 = duminică, 6 = sâmbătă
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}

// Termenul legal implicit de răspuns (Legea 544/2001 — 30 de zile calendaristice
// pentru informații de interes public); configurabil per categorie de formular.
export const DEFAULT_LEGAL_DEADLINE_DAYS = 30;

export function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null;
  const diffMs = new Date(date).getTime() - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

// Calcul generic de termen pentru motorul de workflow (SET_DUE_DATE, memento-uri) —
// suportă toate unitățile din DueDateUnit. BUSINESS_DAYS exclude zilele nelucrătoare
// (vezi addBusinessDays); restul sunt calcule calendaristice simple.
export type DueDateUnit = "MINUTES" | "HOURS" | "BUSINESS_DAYS" | "MONTHS" | "YEARS";

export function computeDueDate(quantity: number, unit: DueDateUnit, from: Date = new Date()): Date {
  if (unit === "BUSINESS_DAYS") return addBusinessDays(from, quantity);
  const result = new Date(from);
  switch (unit) {
    case "MINUTES":
      result.setMinutes(result.getMinutes() + quantity);
      break;
    case "HOURS":
      result.setHours(result.getHours() + quantity);
      break;
    case "MONTHS":
      result.setMonth(result.getMonth() + quantity);
      break;
    case "YEARS":
      result.setFullYear(result.getFullYear() + quantity);
      break;
  }
  return result;
}
