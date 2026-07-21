import { createClient } from "@supabase/supabase-js";

// Singurul loc din frontend care vorbește direct cu Supabase — folosit doar pe
// pagina de acceptare a invitației (setarea parolei inițiale). Restul autentificării
// trece prin backend-ul propriu (`features/iam/api.ts`), care deleagă la Supabase.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string
);
