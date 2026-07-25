// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Stories moderation visibility (blocking, shadow-ban, expiry)
 *
 * Run with:
 *   npx vitest run tests/integration/stories-moderation-live.test.ts
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
  const email = `storymod-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `storymod_${label}_${Date.now()}`, display_name: label },
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

function futureExpiry() {
  return new Date(Date.now() + 24 * 3600_000).toISOString();
}
function pastExpiry() {
  return new Date(Date.now() - 3600_000).toISOString();
}

let userA: { id: string; email: string }; // the blocker
let userB: { id: string; email: string }; // the blocked
let userC: { id: string; email: string }; // uninvolved third party
let userD: { id: string; email: string }; // shadow-banned
let userE: { id: string; email: string }; // uninvolved viewer
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let clientC: ReturnType<typeof createClient>;
let clientD: ReturnType<typeof createClient>;
let clientE: ReturnType<typeof createClient>;
let storyByA: string;
let storyByB: string;
let storyByD: string;
let expiredStory: string;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  userC = await createTestUser("c");
  userD = await createTestUser("d");
  userE = await createTestUser("e");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  clientC = await signInAs(userC.email);
  clientD = await signInAs(userD.email);
  clientE = await signInAs(userE.email);

  const { data: sa } = await admin.from("stories").insert({
    user_id: userA.id, image_url: "https://example.com/a.jpg", expires_at: futureExpiry(),
  }).select().single();
  storyByA = sa!.id;

  const { data: sb } = await admin.from("stories").insert({
    user_id: userB.id, image_url: "https://example.com/b.jpg", expires_at: futureExpiry(),
  }).select().single();
  storyByB = sb!.id;

  const { data: sd } = await admin.from("stories").insert({
    user_id: userD.id, image_url: "https://example.com/d.jpg", expires_at: futureExpiry(),
  }).select().single();
  storyByD = sd!.id;

  const { data: se } = await admin.from("stories").insert({
    user_id: userA.id, image_url: "https://example.com/expired.jpg", expires_at: pastExpiry(),
  }).select().single();
  expiredStory = se!.id;

  // A blocks B beforehand
  await admin.from("blocks").insert({ blocker_id: userA.id, blocked_id: userB.id });

  // D is shadow-banned
  await admin.from("profiles").update({ is_shadow_banned: true }).eq("id", userD.id);
}, 20_000);

afterAll(async () => {
  await admin.from("blocks").delete().eq("blocker_id", userA.id);
  await admin.from("stories").delete().in("id", [storyByA, storyByB, storyByD, expiredStory]);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, userC.id, userD.id, userE.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
  await admin.auth.admin.deleteUser(userD.id);
  await admin.auth.admin.deleteUser(userE.id);
});

describe("LIVE: stories - block visibility", () => {
  it("hides the blocked user's stories from the blocker", async () => {
    const { data } = await clientA.from("stories").select("id").eq("id", storyByB);
    expect(data?.length ?? 0).toBe(0);
  });

  it("hides the blocker's stories from the blocked user (mutual)", async () => {
    const { data } = await clientB.from("stories").select("id").eq("id", storyByA);
    expect(data?.length ?? 0).toBe(0);
  });

  it("does NOT hide either user's stories from an uninvolved third party", async () => {
    const { data: seesA } = await clientC.from("stories").select("id").eq("id", storyByA);
    const { data: seesB } = await clientC.from("stories").select("id").eq("id", storyByB);
    expect(seesA?.length ?? 0).toBe(1);
    expect(seesB?.length ?? 0).toBe(1);
  });

  it("restores visibility after unblocking", async () => {
    await clientA.from("blocks").delete().eq("blocker_id", userA.id).eq("blocked_id", userB.id);
    const { data } = await clientA.from("stories").select("id").eq("id", storyByB);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: stories - shadow-ban visibility", () => {
  it("hides a shadow-banned user's story from other users", async () => {
    const { data } = await clientE.from("stories").select("id").eq("id", storyByD);
    expect(data?.length ?? 0).toBe(0);
  });

  it("still allows the shadow-banned user to see their own story", async () => {
    const { data } = await clientD.from("stories").select("id").eq("id", storyByD);
    expect(data?.length ?? 0).toBe(1);
  });

  it("does not hide a non-shadow-banned user's story", async () => {
    const { data } = await clientE.from("stories").select("id").eq("id", storyByA);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: stories - expiry visibility (regression: was PERMISSIVE, had no effect)", () => {
  it("hides an expired story from other users", async () => {
    const { data } = await clientC.from("stories").select("id").eq("id", expiredStory);
    expect(data?.length ?? 0).toBe(0);
  });
});
