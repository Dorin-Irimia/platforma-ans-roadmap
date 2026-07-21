import { describe, it, expect } from "vitest";
import { adminApi, fetchFileBuffer } from "./helpers";

describe("Arhivă — criptare la arhivare (round-trip prin API)", () => {
  it("un document asociat unui dosar rămâne identic (byte-cu-byte) la citire după criptare", async () => {
    const { api, token } = await adminApi();

    // Găsim orice cerere cu un răspuns generat (document real, PDF) — nu depindem de un
    // ID fix, doar de faptul că cel puțin una există (adevărat în acest set de date demo).
    const { data: requests } = await api("/api/dms/requests");
    let documentId: string | null = null;
    for (const r of requests) {
      const { data: detail } = await api(`/api/dms/requests/${r.id}`);
      const withDoc = (detail.responses || []).find((resp: any) => resp.document?.id);
      if (withDoc) {
        documentId = withDoc.document.id;
        break;
      }
    }
    expect(documentId).toBeTruthy();

    const before = await fetchFileBuffer(token, `/api/dms/documents/${documentId}/file`);
    expect(before.subarray(0, 4).toString()).toBe("%PDF");

    const { data: folder } = await api("/api/dms/archive/folders", {
      method: "POST",
      body: JSON.stringify({ name: `Test criptare Vitest ${Date.now()}`, indexFields: [] }),
    });
    const { status: assignStatus } = await api(`/api/dms/archive/folders/${folder.id}/documents`, {
      method: "POST",
      body: JSON.stringify({ documentIds: [documentId] }),
    });
    expect(assignStatus).toBe(200);

    const after = await fetchFileBuffer(token, `/api/dms/documents/${documentId}/file`);
    expect(after.equals(before)).toBe(true);
    expect(after.subarray(0, 4).toString()).toBe("%PDF");
  });
});
