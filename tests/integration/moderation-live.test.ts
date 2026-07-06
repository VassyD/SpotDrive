// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Account Moderation (ban, suspend, shadow ban)
 *
 * Run with:
 *   npx vitest run tests/integration/moderation-live.test.ts
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
  const email = `mod-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { handle: `mod_${label}_${Date.now()}`, display_name: label },
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

let bannedUser: { id: string; email: string };
let suspendedUser: { id: string; email: string };
let shadowUser: { id: string; email: string };
let normalUser: { id: string; email: string };
let bannedClient: ReturnType<typeof createClient>;
let suspendedClient: ReturnType<typeof createClient>;
let shadowClient: ReturnType<typeof createClient>;
let normalClient: ReturnType<typeof createClient>;
let anonClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  bannedUser = await createTestUser("banned");
  suspendedUser = await createTestUser("suspended");
  shadowUser = await createTestUser("shadow");
  normalUser = await createTestUser("normal");

  bannedClient = await signInAs(bannedUser.email);
  suspendedClient = await signInAs(suspendedUser.email);
  shadowClient = await signInAs(shadowUser.email);
  normalClient = await signInAs(normalUser.email);
  anonClient = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await admin.from("profiles").update({ is_banned: true }).eq("id", bannedUser.id);
  await admin.from("profiles")
    .update({ suspended_until: new Date(Date.now() + 3_600_000).toISOString() })
    .eq("id", suspendedUser.id);
  await admin.from("profiles").update({ is_shadow_banned: true }).eq("id", shadowUser.id);
}, 30_000);

afterAll(async () => {
  await admin.from("spots").delete().in("user_id", [bannedUser.id, suspendedUser.id, shadowUser.id, normalUser.id]);
  await admin.from("profiles").delete().in("id", [bannedUser.id, suspendedUser.id, shadowUser.id, normalUser.id]);
  await admin.auth.admin.deleteUser(bannedUser.id);
  await admin.auth.admin.deleteUser(suspendedUser.id);
  await admin.auth.admin.deleteUser(shadowUser.id);
  await admin.auth.admin.deleteUser(normalUser.id);
});

describe("LIVE: banned users", () => {
  it("cannot insert a new spot", async () => {
    const { error } = await bannedClient.from("spots").insert({
      user_id: bannedUser.id, make: "Test", model: "Banned", status: "live",
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: suspended users", () => {
  it("cannot insert a new spot while suspension is active", async () => {
    const { error } = await suspendedClient.from("spots").insert({
      user_id: suspendedUser.id, make: "Test", model: "Suspended", status: "live",
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: normal (non-moderated) users", () => {
  it("can still insert a new spot", async () => {
    const { error } = await normalClient.from("spots").insert({
      user_id: normalUser.id, make: "Test", model: "Normal", status: "live",
    });
    expect(error).toBeNull();
  });
});

describe("LIVE: shadow-banned users", () => {
  let shadowSpotId: string;

  it("can still insert their own spot", async () => {
    const { data, error } = await shadowClient.from("spots")
      .insert({ user_id: shadowUser.id, make: "Test", model: "Shadow", status: "live" })
      .select().single();
    expect(error).toBeNull();
    shadowSpotId = data!.id;
  });

  it("is hidden from other users", async () => {
    const { data } = await normalClient.from("spots").select("id").eq("id", shadowSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("is hidden from anonymous users", async () => {
    const { data } = await anonClient.from("spots").select("id").eq("id", shadowSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("remains visible to the shadow-banned user themselves", async () => {
    const { data } = await shadowClient.from("spots").select("id").eq("id", shadowSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
});
