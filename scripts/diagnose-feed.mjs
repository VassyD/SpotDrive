import { createClient } from "@supabase/supabase-js";

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await client
  .from("spots")
  .select("*, profiles(handle, avatar_url)")
  .eq("status", "live")
  .order("created_at", { ascending: false })
  .range(0, 9);

console.log("data:", JSON.stringify(data, null, 2));
console.log("error:", JSON.stringify(error, null, 2));
