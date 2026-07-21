import { describe, it, expect } from "vitest";
import { adminApi } from "./helpers";

// Formularul de acreditare federație e seedat cu doar 2 câmpuri obligatorii (SHORT_TEXT),
// deja verificat manual în această sesiune — folosit ca formular fix, mai simplu/robust
// decât a completa dinamic orice tip de câmp posibil dintr-un formular ales aleatoriu.
const ACCREDITATION_FORM_ID = "ec858784-9341-43ea-aac8-e095fd2f7f7a";

describe("Registratură — serii de numerotare independente (intrare vs. intern)", () => {
  it("o cerere depusă prin Portal primește un nr. de INTRARE, fără prefix", async () => {
    const { api } = await adminApi();
    const { status, data } = await api(`/api/dms/portal/forms/${ACCREDITATION_FORM_ID}/submit`, {
      method: "POST",
      body: JSON.stringify({
        submitterName: "Test Federație Vitest",
        submitterEmail: "test-vitest@example.ro",
        data: { denumireFederatie: "Federația Test Vitest", disciplinaFederatie: "Test" },
      }),
    });
    expect(status).toBe(201);
    expect(data.numberKind).toBe("INTRARE");
    expect(data.registryNumber).toMatch(/^\d+\/\d{4}$/);
  });

  it("un transfer sportiv (cerere internă) primește un nr. de INTERN, cu prefix distinct", async () => {
    const { api } = await adminApi();
    const { data: athletes } = await api("/api/sports-registry/athletes");
    const { data: clubs } = await api("/api/sports-registry/clubs");
    const athlete = athletes[0];
    const otherClub = clubs.find((c: any) => c.id !== athlete.clubId) || clubs[0];

    const { status, data } = await api(`/api/sports-registry/athletes/${athlete.id}/transfer-request`, {
      method: "POST",
      body: JSON.stringify({ toClubId: otherClub.id, transferType: "PERMANENT" }),
    });

    expect(status).toBe(201);
    expect(data.request.numberKind).toBe("INTERN");
    // Seria internă folosește un prefix (implicit "INTERN-") ca să nu coincidă niciodată
    // cu seria de intrare pe coloana unică registryNumber — vezi registryNumbering.ts.
    expect(data.request.registryNumber).not.toMatch(/^\d+\/\d{4}$/);
  });
});
