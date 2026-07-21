import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeClientOptions } from "@supabase/supabase-js";
import ws from "ws";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error("Lipsesc variabilele de mediu SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY");
}

const authOptions = { autoRefreshToken: false, persistSession: false } as const;
// Node 20 nu are WebSocket nativ — clientul Realtime al supabase-js (neutilizat aici,
// dar instanțiat la construcție) are nevoie explicit de un polyfill.
const realtimeOptions = { transport: ws as unknown as RealtimeClientOptions["transport"] };

// service_role — bypass RLS, folosit pentru operații admin (getUser, inviteUserByEmail,
// createUser, updateUserById). Nu ajunge niciodată în frontend.
export const supabaseAdmin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: authOptions,
  realtime: realtimeOptions,
});

// anon — folosit strict pentru signInWithPassword (verificare credențiale la login).
export const supabaseAnon: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authOptions,
  realtime: realtimeOptions,
});

// Client efemer "ca utilizatorul curent" — operațiile auth.mfa.* (enroll/verify/unenroll/
// listFactors/getAuthenticatorAssuranceLevel) acționează pe sesiunea proprietarului
// tokenului, nu pot fi făcute prin service_role sau prin clientul anon fără context.
export function supabaseAsUser(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, {
    auth: authOptions,
    realtime: realtimeOptions,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
