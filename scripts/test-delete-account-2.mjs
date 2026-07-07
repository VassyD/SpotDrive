import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- Test 1: unauthenticated request should be rejected ---
console.log("Test 1: calling without auth header...");
const res1 = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: "POST" });
console.log("Status:", res1.status, "(expect 401)");
console.log(await res1.json());

// --- Test 2: cascade deletion ---
const email = `cascade-test-${Date.now()}@example.com`;
const password = "test-password-123";

const { data: created } = await admin.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { handle: `cascade_${Date.now()}`, display_name: "Cascade Test" },
});
const userId = created.user.id;

const { data: spot } = await admin.from("spots")
  .insert({ user_id: userId, make: "Test", model: "CascadeCheck", status: "live" })
  .select().single();
console.log("\nCreated user", userId, "with spot", spot.id);

const client = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: signInData } = await client.auth.signInWithPassword({ email, password });
const accessToken = signInData.session.access_token;

console.log("\nTest 2: deleting account with an associated spot...");
const res2 = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
});
console.log("Status:", res2.status, await res2.json());

const { data: spotCheck } = await admin.from("spots").select("id").eq("id", spot.id).maybeSingle();
console.log("\nSpot still exists after account deletion?", spotCheck ? "YES (cascade BROKEN!)" : "No (cascade worked correctly)");

const { data: profileCheck } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
console.log("Profile still exists?", profileCheck ? "YES (BUG!)" : "No (correctly deleted)");
