import { createClient } from "@supabase/supabase-js";

// Singurele locuri din frontend care vorbesc direct cu Supabase — AcceptInvitePage.tsx
// (setarea parolei inițiale) și ResetPasswordPage.tsx (resetare parolă), ambele bazate pe
// linkuri Supabase (invite/recovery) care stabilesc sesiunea automat din fragmentul URL.
// Restul autentificării trece prin backend-ul propriu (`features/iam/api.ts`), care
// deleagă la Supabase.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);
