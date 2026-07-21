import { describe, it, expect } from "vitest";
import { adminApi, submitFormWithDummyData } from "./helpers";

const FINANCE_FORM_ID = "4cf33ae2-0547-4f71-ad2f-9bdc1c6514e6"; // "Cerere de finanțare nerambursabilă", categoria "cis"

describe("Workflow — motorul de stări/tranziții", () => {
  it("o cerere nouă poate fi inițiată și avansată printr-un flux real", async () => {
    const { api } = await adminApi();

    const { data: defs } = await api("/api/dms/workflow-defs");
    const financeDef = defs.find((d: any) => d.category === "cis");
    expect(financeDef).toBeTruthy();

    const { data: fullDef } = await api(`/api/dms/workflow-defs/${financeDef.id}`);
    const startTransition = fullDef.transitions.find((t: any) => t.fromStateId === null);
    expect(startTransition).toBeTruthy();

    const { status: submitStatus, data: request } = await submitFormWithDummyData(api, FINANCE_FORM_ID);
    expect(submitStatus).toBe(201);

    const { status: initStatus, data: afterInit } = await api(`/api/dms/requests/${request.id}/workflow/initiate`, {
      method: "POST",
      body: JSON.stringify({ transitionId: startTransition.id }),
    });
    expect(initStatus).toBe(201);
    expect(afterInit.currentStateId).toBe(startTransition.toStateId);

    const nextTransition = fullDef.transitions.find((t: any) => t.fromStateId === startTransition.toStateId);
    if (nextTransition) {
      const { status: advanceStatus, data: afterAdvance } = await api(`/api/dms/requests/${request.id}/workflow/advance`, {
        method: "POST",
        body: JSON.stringify({ transitionId: nextTransition.id }),
      });
      expect(advanceStatus).toBe(200);
      expect(afterAdvance.currentStateId).toBe(nextTransition.toStateId);
    }
  });
});
