import { describe, it, expect } from "vitest";
import { adminApi, BASE, ADMIN_EMAIL } from "./helpers";

describe("Audit — IP/browser automate (AsyncLocalStorage)", () => {
  it("un login eșuat, cu un User-Agent custom, apare în jurnal cu IP și browser populate automat", async () => {
    const marker = `VitestAgent/${Date.now()}`;
    await fetch(`${BASE}/api/iam/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": marker },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: "parola-gresita-test-audit" }),
    });

    const { api } = await adminApi();
    const { data: logs } = await api(`/api/iam/audit?action=LOGIN_FAILED&limit=20`);
    const entry = logs.find((l: any) => l.userAgent === marker);

    expect(entry).toBeTruthy();
    expect(entry.ipAddress).toBeTruthy();
    expect(entry.userAgent).toBe(marker);
  });

  it("o schimbare de rol înregistrează valorile vechi și noi", async () => {
    const { api } = await adminApi();
    const { data: users } = await api("/api/iam/users");
    const target = users.find((u: any) => u.email !== ADMIN_EMAIL);
    expect(target).toBeTruthy();

    const originalRole = target.role;
    const tempRole = originalRole === "EVALUATOR" ? "AUTOR" : "EVALUATOR";

    await api(`/api/iam/users/${target.id}/role`, { method: "PATCH", body: JSON.stringify({ role: tempRole }) });
    const { data: logs } = await api("/api/iam/audit?action=ROLE_CHANGED&limit=5");
    const entry = logs.find((l: any) => l.resource === `user:${target.id}`);

    expect(entry).toBeTruthy();
    expect(entry.metadata.newRole).toBe(tempRole);
    expect(entry.metadata.oldRole).toBe(originalRole);

    // Curățenie — readucem rolul la valoarea inițială, ca testul să fie idempotent.
    await api(`/api/iam/users/${target.id}/role`, { method: "PATCH", body: JSON.stringify({ role: originalRole }) });
  });
});
