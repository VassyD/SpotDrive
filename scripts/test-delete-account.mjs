import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = `delete-test-${Date.now()}@example.com`;
const password = "test-password-123";

console.log("Creating test user:", email);
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { handle: `del_test_${Date.now()}`, display_name: "Delete Test" },
});
if (createErr) { console.error("Create failed:", createErr); process.exit(1); }
const userId = created.user.id;
console.log("Created user:", userId);

const client = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({ email, password });
if (signInErr) { console.error("Sign in failed:", signInErr); process.exit(1); }
const accessToken = signInData.session.access_token;
console.log("Signed in, got access token.");

console.log("\nCalling delete-account function...");
const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
});
const result = await res.json();
console.log("Function response:", res.status, result);

// Verify the user is actually gone
const { data: checkUser } = await admin.auth.admin.getUserById(userId);
console.log("\nUser still exists after deletion attempt?", checkUser?.user ? "YES (BUG!)" : "No (correctly deleted)");
