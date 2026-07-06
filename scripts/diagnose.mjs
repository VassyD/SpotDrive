import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.createUser({
  email: "diagnostic-test-" + Date.now() + "@example.com",
  password: crypto.randomUUID(),
  email_confirm: true,
  user_metadata: { handle: "diag_test", display_name: "Diag Test" },
});

console.log("data:", JSON.stringify(data, null, 2));
console.log("error:", JSON.stringify(error, null, 2));
console.log("error (raw):", error);
