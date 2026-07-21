import { describe, it, expect } from "vitest";
import { adminApi } from "./helpers";

// An de test îndepărtat de anul curent — ca să nu se amestece niciodată cu ediția reală
// 2026 deja publicată OFICIAL (afișată public pe Almanahul Online). Testul NU publică
// nimic ca OFICIAL, exact din același motiv — s-ar suprascrie ediția "latest" publică reală.
const TEST_YEAR = 2099;

describe("Anuarul Sportului — ciclul de viață al unei ediții", () => {
  it("generare → avertismente de date lipsă → blocare validare fără force → validare cu force", async () => {
    const { api } = await adminApi();

    const { status: genStatus, data: edition } = await api("/api/yearbook/yearbook/generate", {
      method: "POST",
      body: JSON.stringify({ year: TEST_YEAR }),
    });
    expect(genStatus).toBe(201);
    expect(edition.status).toBe("PROVIZORIU");
    expect(edition.snapshot.year).toBe(TEST_YEAR);
    expect(Array.isArray(edition.missingDataWarnings)).toBe(true);

    if (edition.missingDataWarnings.length > 0) {
      const { status: blockedStatus } = await api(`/api/yearbook/yearbook/editions/${edition.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "VALIDAT" }),
      });
      expect(blockedStatus).toBe(409);
    }

    const { status: validatedStatus, data: validated } = await api(`/api/yearbook/yearbook/editions/${edition.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "VALIDAT", force: true }),
    });
    expect(validatedStatus).toBe(200);
    expect(validated.status).toBe("VALIDAT");
    expect(validated.validatedAt).toBeTruthy();

    // Nu publicăm ca OFICIAL — vezi comentariul de mai sus.
  });
});
