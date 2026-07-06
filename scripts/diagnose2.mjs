import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: user } = await admin.auth.admin.createUser({
  email: `diag2-${Date.now()}@example.com`,
  password: "test-password-123",
  email_confirm: true,
  user_metadata: { handle: `diag2_${Date.now()}`, display_name: "Diag2" },
});

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
await client.auth.signInWithPassword({ email: user.user.email, password: "test-password-123" });

const { error } = await client.from("spots").insert({
  user_id: user.user.id, make: "Test", model: "Diag2", status: "live",
});

console.log("FULL ERROR:", JSON.stringify(error, null, 2));

await admin.auth.admin.deleteUser(user.user.id);
