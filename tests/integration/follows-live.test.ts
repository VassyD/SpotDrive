// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Test: Follow counts
 *
 * Verifies the on_follow_change trigger correctly maintains
 * followers_count/following_count exactly once per follow/unfollow
 * (previously double-counted by redundant client-side updates).
 *
 * Run with:
 *   npx vitest run tests/integration/follows-live.test.ts
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
  const email = `follow-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `flw_${label}_${Date.now()}`, display_name: label },
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

let follower: { id: string; email: string };
let target: { id: string; email: string };
let followerClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  follower = await createTestUser("follower");
  target = await createTestUser("target");
  followerClient = await signInAs(follower.email);
}, 20_000);

afterAll(async () => {
  await admin.from("follows").delete().eq("follower_id", follower.id);
  await admin.from("profiles").delete().in("id", [follower.id, target.id]);
  await admin.auth.admin.deleteUser(follower.id);
  await admin.auth.admin.deleteUser(target.id);
});

async function getCounts() {
  const { data: t } = await admin.from("profiles").select("followers_count").eq("id", target.id).single();
  const { data: f } = await admin.from("profiles").select("following_count").eq("id", follower.id).single();
  return { followersCount: t?.followers_count, followingCount: f?.following_count };
}

describe("LIVE: follow counts (trigger-only, no client double-count)", () => {
  it("starts at 0 for both", async () => {
    const c = await getCounts();
    expect(c.followersCount).toBe(0);
    expect(c.followingCount).toBe(0);
  });

  it("following increments both counts by exactly 1 (not 2)", async () => {
    const { error } = await followerClient.from("follows")
      .insert({ follower_id: follower.id, following_id: target.id });
    expect(error).toBeNull();

    const c = await getCounts();
    expect(c.followersCount).toBe(1);
    expect(c.followingCount).toBe(1);
  });

  it("unfollowing decrements both counts by exactly 1 (not 2), back to 0", async () => {
    const { error } = await followerClient.from("follows")
      .delete().eq("follower_id", follower.id).eq("following_id", target.id);
    expect(error).toBeNull();

    const c = await getCounts();
    expect(c.followersCount).toBe(0);
    expect(c.followingCount).toBe(0);
  });
});
