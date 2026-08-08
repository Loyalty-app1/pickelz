import { createClient } from "@supabase/supabase-js";

// Clé "publishable" (anon) : conçue pour être embarquée dans le front — la
// sécurité vient des règles RLS, pas du secret de la clé. OK de la committer.
const SUPABASE_URL = "https://oqpwlolwergdspagfxzl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2qKSFhA432Cv3W4KibTjLQ_FOEBdZpP";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // l'app n'utilise pas Supabase Auth
});
