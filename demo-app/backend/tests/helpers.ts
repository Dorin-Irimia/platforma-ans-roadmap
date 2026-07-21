// Helper comun pentru testele de integrare — aceleași tipare (login + wrapper fetch)
// folosite în toate scripturile de seed/verificare din această sesiune, acum salvate ca
// teste re-rulabile. Implicit `http://backend:4000` (numele serviciului din docker-compose,
// rezolvat prin DNS-ul intern al rețelei compose) — suprascriabil cu TEST_API_URL pentru
// rulare din alt context (ex. direct pe host, cu portul expus 4000).
export const BASE = process.env.TEST_API_URL || "http://backend:4000";

export const ADMIN_EMAIL = "admin@ans-demo.ro";
export const ADMIN_PASSWORD = "AnsDemo#2026!";

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE}/api/iam/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.token) throw new Error(`Login eșuat pentru ${email}: ${JSON.stringify(data)}`);
  return data.token;
}

export function apiAs(token: string) {
  return async (path: string, opts: RequestInit = {}) => {
    // FormData își setează singur Content-Type (cu boundary-ul multipart corect) — dacă
    // forțăm application/json peste el, serverul (multer) nu mai poate parsa cererea.
    const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: { ...(isFormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, ok: res.ok, data };
  };
}

// Un singur login per test (nu unul per helper apelat) — evită să lovim limitarea de
// rată de pe /iam/login (20/minut/IP) când mai multe teste rulează în aceeași fereastră.
export async function adminApi(): Promise<{ api: ReturnType<typeof apiAs>; token: string }> {
  const token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  return { api: apiAs(token), token };
}

// Pentru fișiere binare (PDF etc.) — apiAs de mai sus presupune JSON/text, nu potrivit
// pentru compararea byte-cu-byte a unui document criptat/decriptat.
export async function fetchFileBuffer(token: string, path: string): Promise<Buffer> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Descărcare fișier eșuată (${res.status}): ${path}`);
  return Buffer.from(await res.arrayBuffer());
}

// Valoare implicită per tip de câmp — pentru completarea automată a unui formular
// oarecare fără să fie nevoie să cunoaștem în avans exact ce conține.
function dummyValueFor(type: string): unknown {
  switch (type) {
    case "SHORT_NUMBER":
    case "LONG_NUMBER":
      return 1;
    case "EMAIL":
      return "test-vitest@example.ro";
    case "DATE":
      return new Date().toISOString().slice(0, 10);
    case "CHECKBOX":
      return true;
    default:
      return "Test automat (Vitest)";
  }
}

// Depune un formular publicat, completând automat toate câmpurile obligatorii cu valori
// implicite plauzibile — folosit de testele care au nevoie doar de "o cerere oarecare",
// nu de conținutul ei specific.
export async function submitFormWithDummyData(api: ReturnType<typeof apiAs>, formId: string) {
  const { data: form } = await api(`/api/dms/forms/${formId}`);
  const allFields = [...form.sections.flatMap((s: any) => s.fields), ...form.fields];
  const data: Record<string, unknown> = {};
  for (const f of allFields) {
    if (f.required) data[f.key] = dummyValueFor(f.type);
  }
  return api(`/api/dms/portal/forms/${formId}/submit`, {
    method: "POST",
    body: JSON.stringify({ submitterName: "Test Vitest", submitterEmail: "test-vitest@example.ro", data }),
  });
}
