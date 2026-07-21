import { overdueCount, nearDueCount, backlogCount, unassignedCount, totalRequests, staffUserCount, avgResolutionDays } from "./metrics";

// Registru de metrici scalare disponibile pentru alertele BI (BiAlertRule.metricKey) —
// doar funcțiile din metrics.ts care întorc direct un număr, fără parametri obligatorii.
export const ALERT_METRICS: Record<string, { label: string; fn: () => Promise<number | null> }> = {
  overdueCount: { label: "Cereri cu termen depășit", fn: overdueCount },
  nearDueCount: { label: "Cereri cu termen apropiat (3 zile)", fn: () => nearDueCount() },
  backlogCount: { label: "Cereri active (backlog)", fn: backlogCount },
  unassignedCount: { label: "Cereri nealocate", fn: unassignedCount },
  totalRequests: { label: "Total cereri înregistrate", fn: totalRequests },
  staffUserCount: { label: "Conturi de personal active", fn: staffUserCount },
  avgResolutionDays: { label: "Zile medii de soluționare", fn: avgResolutionDays },
};

export function evaluateOperator(value: number, operator: "GT" | "GTE" | "LT" | "LTE", threshold: number): boolean {
  switch (operator) {
    case "GT":
      return value > threshold;
    case "GTE":
      return value >= threshold;
    case "LT":
      return value < threshold;
    case "LTE":
      return value <= threshold;
  }
}
