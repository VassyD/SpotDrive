// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Likes and Saves
 *
 * Run with:
 *   npx vitest run tests/integration/likes-saves-live.test.ts
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
  const email = `ls-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `ls_${label}_${Date.now()}`, display_name: label },
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

let owner: { id: string; email: string };
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);

  const { data: spot, error } = await admin
    .from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "LikesSaves", status: "live" })
    .select().single();
  if (error || !spot) throw new Error(`Failed to create test spot: ${error?.message}`);
  spotId = spot.id;
}, 30_000);

afterAll(async () => {
  await admin.from("likes").delete().eq("spot_id", spotId);
  await admin.from("saves").delete().eq("spot_id", spotId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [owner.id, userA.id, userB.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
});

async function getSpotCounts() {
  const { data } = await admin.from("spots").select("likes_count, saves_count").eq("id", spotId).single();
  return data;
}

describe("LIVE: likes", () => {
  it("starts at 0", async () => {
    const counts = await getSpotCounts();
    expect(counts?.likes_count).toBe(0);
  });

  it("allows a user to like a spot, incrementing the count", async () => {
    const { error } = await clientA.from("likes").insert({ spot_id: spotId, user_id: userA.id });
    expect(error).toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.likes_count).toBe(1);
  });

  it("prevents the same user from liking the same spot twice", async () => {
    const { error } = await clientA.from("likes").insert({ spot_id: spotId, user_id: userA.id });
    expect(error).not.toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.likes_count).toBe(1); // unchanged
  });

  it("a second distinct user liking increments the count again", async () => {
    const { error } = await clientB.from("likes").insert({ spot_id: spotId, user_id: userB.id });
    expect(error).toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.likes_count).toBe(2);
  });

  it("unliking (delete) decrements the count", async () => {
    const { error } = await clientA.from("likes").delete().eq("spot_id", spotId).eq("user_id", userA.id);
    expect(error).toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.likes_count).toBe(1);
  });

  it("prevents a user from liking on behalf of someone else", async () => {
    const { error } = await clientA.from("likes").insert({ spot_id: spotId, user_id: userB.id });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: saves", () => {
  it("allows a user to save a spot, incrementing the count", async () => {
    const { error } = await clientA.from("saves").insert({ spot_id: spotId, user_id: userA.id });
    expect(error).toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.saves_count).toBe(1);
  });

  it("prevents the same user from saving the same spot twice", async () => {
    const { error } = await clientA.from("saves").insert({ spot_id: spotId, user_id: userA.id });
    expect(error).not.toBeNull();
  });

  it("unsaving (delete) decrements the count", async () => {
    const { error } = await clientA.from("saves").delete().eq("spot_id", spotId).eq("user_id", userA.id);
    expect(error).toBeNull();
    const counts = await getSpotCounts();
    expect(counts?.saves_count).toBe(0);
  });
});
