import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
// VITE_SUPABASE_ANON_KEY reste accepté pour les anciens projets.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);

export const supabase = configured ? createClient(url, key) : null;
