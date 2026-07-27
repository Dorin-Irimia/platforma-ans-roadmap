import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "platforma-ans" — hostname local adăugat manual în C:\Windows\System32\drivers\etc\hosts
  // (→ 127.0.0.1), ca bara de adrese să arate numele platformei în loc de "localhost".
  server: { host: true, port: 5173, allowedHosts: ["platforma-ans"] }
});
