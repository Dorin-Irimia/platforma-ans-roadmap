import { defineConfig } from "vitest/config";

// Teste de integrare reale — fac cereri HTTP către serverul deja pornit (docker compose),
// nu o bază de date de test izolată (schimbare de infrastructură nejustificată pt. un demo).
// Timeout mărit față de implicit (5s) pentru că unele teste ating fluxuri AI reale (Groq).
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Serial, nu paralel — fiecare fișier de test se autentifică independent; rulate
    // simultan, ar depăși rapid limitarea de rată de pe /iam/login (20/minut/IP),
    // aceeași limitare reală testată explicit în alte fluxuri ale platformei.
    fileParallelism: false,
  },
});
