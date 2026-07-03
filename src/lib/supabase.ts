import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://lhahofbryglxdxffxjbr.supabase.co";

const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYWhvZmJyeWdseGR4ZmZ4amJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MzA5ODgsImV4cCI6MjA5ODMwNjk4OH0.5rmKCnWqROlefWII7QpHsbY8xUMJytL6CoJ8LYsaUGQ";

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    "Missing Supabase environment variables. " +
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
});
