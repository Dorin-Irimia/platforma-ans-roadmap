// crypto.randomUUID() există doar în "secure context" (https:, sau localhost/127.0.0.1
// special-cazate de browser) — pe hostname-uri custom accesate prin http:// simplu
// (ex. http://platforma-ans:5173, vezi vite.config.ts allowedHosts), funcția lipsește
// și aruncă TypeError la orice apel. Aceste id-uri sunt identificatori interni de conținut
// (bloc de lecție, întrebare de test), nu au nevoie de garanții criptografice — un fallback
// bazat pe Math.random e suficient de unic pentru acest scop.
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
