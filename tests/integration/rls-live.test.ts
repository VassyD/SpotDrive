// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE RLS Integration Tests
 *
 * Unlike tests/integration/rls.test.ts (which mocks expected behaviour),
 * these tests run against a REAL local Postgres database via the
 * Supabase CLI's local dev stack, with REAL authenticated users and
 * REAL Row Level Security enforcement.
 *
 * Prerequisites:
 *   1. Docker Desktop running
 *   2. `supabase start` has been run in this project (see supabase/ folder)
 *
 * Run with:
 *   npx vitest run tests/integration/rls-live.test.ts
 *
 * These are intentionally excluded from the default `npm test` run since
 * they require Docker + the local stack to be up. Run them manually or
 * wire into CI as a separate job with the Supabase CLI available.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env vars.\n" +
    "Run `supabase status -o env` to get local values, or copy from the\n" +
    "'supabase start' output (Publishable key = anon, Secret key = service_role)."
  );
}

// Admin client — bypasses RLS entirely, used only for test setup/teardown
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "test-password-123";
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let anonClient: ReturnType<typeof createClient>;
let testSpotId: string;

async function createTestUser(label: string) {
  const email = `rls-test-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true, // skip real email confirmation for test users
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

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  anonClient = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Insert matching profile rows, as the app's real signup flow would
  await admin.from("profiles").insert([
    { id: userA.id, handle: `rls_a_${Date.now()}`, display_name: "RLS Test A" },
    { id: userB.id, handle: `rls_b_${Date.now()}`, display_name: "RLS Test B" },
  ]);

  // Create a spot for comment tests to reference (comments.spot_id is NOT NULL)
  const { data: spot, error: spotError } = await admin
    .from("spots")
    .insert({ user_id: userA.id, make: "Test", model: "Spot", status: "live" })
    .select()
    .single();
  if (spotError || !spot) throw new Error(`Failed to create test spot: ${spotError?.message}`);
  testSpotId = spot.id;
}, 30_000);

afterAll(async () => {
  // Clean up: delete test users (cascades should handle related rows if FKs are set up that way;
  // otherwise clean up explicitly first)
  if (testSpotId) await admin.from("spots").delete().eq("id", testSpotId);
  await admin.from("spots").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("comments").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("stories").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("follows").delete().in("follower_id", [userA.id, userB.id]);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id]);
  if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
  if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
});

// --- Profiles ---
describe("LIVE RLS: profiles table", () => {
  it("allows anyone (including anon) to read profiles", async () => {
    const { data, error } = await anonClient.from("profiles").select("id").eq("id", userA.id).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(userA.id);
  });

  it("allows a user to update their own profile", async () => {
    const { error } = await clientA
      .from("profiles")
      .update({ bio: "Updated by owner" })
      .eq("id", userA.id);
    expect(error).toBeNull();
  });

  it("prevents a user from updating someone else's profile", async () => {
    const { data, error } = await clientB
      .from("profiles")
      .update({ bio: "Hijacked!" })
      .eq("id", userA.id)
      .select();
    // RLS silently returns 0 rows affected rather than an explicit error
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });
});

// --- Spots ---
describe("LIVE RLS: spots table", () => {
  let spotAId: string;

  it("allows an authenticated user to insert their own spot", async () => {
    const { data, error } = await clientA
      .from("spots")
      .insert({ user_id: userA.id, make: "Ferrari", model: "SF90", status: "live" })
      .select()
      .single();
    expect(error).toBeNull();
    expect(data?.user_id).toBe(userA.id);
    spotAId = data!.id;
  });

  it("prevents inserting a spot for a different user_id", async () => {
    const { error } = await clientB
      .from("spots")
      .insert({ user_id: userA.id, make: "Fake", model: "Injection", status: "live" });
    expect(error).not.toBeNull();
  });

  it("prevents a user from updating someone else's spot", async () => {
    const { data, error } = await clientB
      .from("spots")
      .update({ model: "Hijacked" })
      .eq("id", spotAId)
      .select();
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it("allows the owner to delete their own spot", async () => {
    const { error } = await clientA.from("spots").delete().eq("id", spotAId);
    expect(error).toBeNull();
  });
});

// --- Comments ---
describe("LIVE RLS: comments table", () => {
  it("allows an authenticated user to insert a comment as themselves", async () => {
    const { error } = await clientA.from("comments").insert({
      user_id: userA.id,
      spot_id: testSpotId,
      text: "test comment",
    });
    expect(error).toBeNull();
  });

  it("prevents inserting a comment as another user", async () => {
    const { error } = await clientB.from("comments").insert({
      user_id: userA.id,
      spot_id: testSpotId,
      text: "spoofed comment",
    });
    expect(error).not.toBeNull();
  });
});

// --- Stories ---
describe("LIVE RLS: stories table", () => {
  it("hides expired stories from select", async () => {
    // Insert an already-expired story directly via admin (bypassing RLS on insert)
    await admin.from("stories").insert({
      user_id: userA.id,
      expires_at: new Date(Date.now() - 3_600_000).toISOString(),
    });

    const { data, error } = await anonClient
      .from("stories")
      .select("*")
      .eq("user_id", userA.id)
      .lt("expires_at", new Date().toISOString());

    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // policy filters it out even though the row exists
  });
});

// --- Follows ---
describe("LIVE RLS: follows table", () => {
  it("allows a user to create their own follow relationship", async () => {
    const { error } = await clientA.from("follows").insert({
      follower_id: userA.id,
      following_id: userB.id,
    });
    expect(error).toBeNull();
  });

  it("prevents a user from creating a follow row on someone else's behalf", async () => {
    const { error } = await clientB.from("follows").insert({
      follower_id: userA.id,
      following_id: userB.id,
    });
    expect(error).not.toBeNull();
  });
});
