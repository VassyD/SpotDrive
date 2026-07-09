// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: profile_private_info
 *
 * Run with:
 *   npx vitest run tests/integration/profile-private-info-live.test.ts
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SERVICE_KEY) {
  throw new Error("Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env vars.");
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "test-password-123";

async function createTestUser(label: string) {
  const email = `pinfo-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `pinfo_${label}_${Date.now()}`, display_name: label },
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
  return { id: data.user.id, email };
}

async function signInAs(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  return client;
}

let userA: { id: string; email: string };
let userB: { id: string; email: string };
let adminUser: { id: string; email: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let adminClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  adminUser = await createTestUser("admin");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  adminClient = await signInAs(adminUser.email);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
}, 20_000);

afterAll(async () => {
  await admin.from("profile_private_info").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, adminUser.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(adminUser.id);
});

describe("LIVE: profile_private_info", () => {
  it("the signup trigger auto-creates an (empty) private info row for every user", async () => {
    const { data, error } = await admin.from("profile_private_info")
      .select("user_id").eq("user_id", userA.id).single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.id);
  });

  it("allows the owner to update their own private info", async () => {
    const { error } = await clientA.from("profile_private_info")
      .update({ date_of_birth: "1995-06-15", town: "Adelaide", state: "South Australia", country: "Australia" })
      .eq("user_id", userA.id);
    expect(error).toBeNull();
  });

  it("prevents a user from updating someone else's private info", async () => {
    const { data, error } = await clientB.from("profile_private_info")
      .update({ town: "Fake" }).eq("user_id", userA.id).select();
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // RLS silently blocks, no rows affected
  });

  it("allows the owner to view their own private info", async () => {
    const { data, error } = await clientA.from("profile_private_info")
      .select("*").eq("user_id", userA.id).single();
    expect(error).toBeNull();
    expect(data?.town).toBe("Adelaide");
  });

  it("prevents a different regular user from viewing someone else's private info", async () => {
    const { data, error } = await clientB.from("profile_private_info")
      .select("*").eq("user_id", userA.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // RLS silently hides it
  });

  it("allows an admin to view any user's private info", async () => {
    const { data, error } = await adminClient.from("profile_private_info")
      .select("*").eq("user_id", userA.id).single();
    expect(error).toBeNull();
    expect(data?.town).toBe("Adelaide");
  });

  it("stores date_of_birth correctly for on-demand age computation later", async () => {
    // Age is deliberately never stored — an admin analytics query would
    // compute it live, e.g.:
    //   SELECT EXTRACT(YEAR FROM AGE(current_date, date_of_birth)) AS age
    //   FROM profile_private_info;
    // This test just confirms the raw DOB is stored and retrievable correctly.
    const { data, error } = await admin
      .from("profile_private_info")
      .select("date_of_birth")
      .eq("user_id", userA.id)
      .single();
    expect(error).toBeNull();
    expect(data?.date_of_birth).toBe("1995-06-15");
  });
});

describe("LIVE: signup metadata auto-populates profile_private_info", () => {
  it("the handle_new_user trigger creates a private info row from signup metadata", async () => {
    const email = `pinfo-trigger-${Date.now()}@example.com`;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password: PASSWORD, email_confirm: true,
      user_metadata: {
        handle: `pinfo_trigger_${Date.now()}`,
        display_name: "Trigger Test",
        date_of_birth: "1990-03-20",
        town: "Perth",
        state: "Western Australia",
        country: "Australia",
      },
    });
    expect(createErr).toBeNull();
    const newUserId = created!.user!.id;

    const { data: info, error: infoErr } = await admin
      .from("profile_private_info")
      .select("*")
      .eq("user_id", newUserId)
      .single();
    expect(infoErr).toBeNull();
    expect(info?.date_of_birth).toBe("1990-03-20");
    expect(info?.town).toBe("Perth");
    expect(info?.state).toBe("Western Australia");
    expect(info?.country).toBe("Australia");

    await admin.from("profile_private_info").delete().eq("user_id", newUserId);
    await admin.from("profiles").delete().eq("id", newUserId);
    await admin.auth.admin.deleteUser(newUserId);
  });
});