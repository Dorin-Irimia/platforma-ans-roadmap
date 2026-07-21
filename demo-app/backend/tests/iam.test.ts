import { describe, it, expect } from "vitest";
import { login, ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

describe("IAM — autentificare", () => {
  it("login valid întoarce un token", async () => {
    const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("login cu parolă greșită eșuează", async () => {
    await expect(login(ADMIN_EMAIL, "parola-gresita-cu-siguranta")).rejects.toThrow();
  });
});
