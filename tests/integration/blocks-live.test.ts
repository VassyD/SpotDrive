// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Blocking
 *
 * Run with:
 *   npx vitest run tests/integration/blocks-live.test.ts
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
  const email = `block-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `block_${label}_${Date.now()}`, display_name: label },
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

let userA: { id: string; email: string }; // the blocker
let userB: { id: string; email: string }; // the blocked
let userC: { id: string; email: string }; // uninvolved third party
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let clientC: ReturnType<typeof createClient>;
let spotByA: string;
let spotByB: string;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  userC = await createTestUser("c");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  clientC = await signInAs(userC.email);

  const { data: sa } = await admin.from("spots").insert({ user_id: userA.id, make: "Test", model: "BlockA", status: "live" }).select().single();
  spotByA = sa!.id;
  const { data: sb } = await admin.from("spots").insert({ user_id: userB.id, make: "Test", model: "BlockB", status: "live" }).select().single();
  spotByB = sb!.id;

  // A follows B beforehand, to verify blocking removes it
  await admin.from("follows").insert({ follower_id: userA.id, following_id: userB.id });
}, 20_000);

afterAll(async () => {
  await admin.from("blocks").delete().eq("blocker_id", userA.id);
  await admin.from("spots").delete().in("id", [spotByA, spotByB]);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, userC.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
});

describe("LIVE: blocks", () => {
  it("prevents a user from blocking themselves", async () => {
    const { error } = await clientA.from("blocks").insert({ blocker_id: userA.id, blocked_id: userA.id });
    expect(error).not.toBeNull();
  });

  it("allows a user to block another user", async () => {
    const { error } = await clientA.from("blocks").insert({ blocker_id: userA.id, blocked_id: userB.id });
    expect(error).toBeNull();
  });

  it("auto-removes the existing follow relationship in both directions", async () => {
    const { data } = await admin.from("follows").select("*")
      .or(`and(follower_id.eq.${userA.id},following_id.eq.${userB.id}),and(follower_id.eq.${userB.id},following_id.eq.${userA.id})`);
    expect(data?.length ?? 0).toBe(0);
  });

  it("hides the blocked user's spots from the blocker", async () => {
    const { data } = await clientA.from("spots").select("id").eq("id", spotByB);
    expect(data?.length ?? 0).toBe(0);
  });

  it("hides the blocker's spots from the blocked user (mutual)", async () => {
    const { data } = await clientB.from("spots").select("id").eq("id", spotByA);
    expect(data?.length ?? 0).toBe(0);
  });

  it("does NOT hide either user's spots from an uninvolved third party", async () => {
    const { data: seesA } = await clientC.from("spots").select("id").eq("id", spotByA);
    const { data: seesB } = await clientC.from("spots").select("id").eq("id", spotByB);
    expect(seesA?.length ?? 0).toBe(1);
    expect(seesB?.length ?? 0).toBe(1);
  });

  it("is invisible to the blocked user (they cannot see they've been blocked)", async () => {
    const { data } = await clientB.from("blocks").select("*").eq("blocked_id", userB.id);
    expect(data?.length ?? 0).toBe(0); // RLS only exposes blocks to the blocker
  });

  it("allows the blocker to see their own block list", async () => {
    const { data, error } = await clientA.from("blocks").select("*").eq("blocker_id", userA.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(1);
  });

  it("restores visibility after unblocking", async () => {
    await clientA.from("blocks").delete().eq("blocker_id", userA.id).eq("blocked_id", userB.id);
    const { data } = await clientA.from("spots").select("id").eq("id", spotByB);
    expect(data?.length ?? 0).toBe(1);
  });
});
