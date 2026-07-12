// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Rate limiting
 *
 * Run with:
 *   npx vitest run tests/integration/rate-limiting-live.test.ts
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
  const email = `ratelimit-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `rl_${label}_${Date.now()}`, display_name: label },
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
let commenterClient: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  commenterClient = await signInAs(userA.email);

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: userA.id, make: "Test", model: "RateLimitTest", status: "live" })
    .select().single();
  spotId = spot!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("rate_limit_log").delete().in("user_id", [userA.id, userB.id]);
  await admin.from("comments").delete().eq("spot_id", spotId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
});

describe("LIVE: check_rate_limit function", () => {
  it("allows actions under the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const { data, error } = await admin.rpc("check_rate_limit", {
        p_user_id: userA.id, p_action_type: "test_action", p_max_count: 3, p_window_seconds: 60,
      });
      expect(error).toBeNull();
      expect(data).toBe(true);
    }
  });

  it("blocks the action once the limit is reached", async () => {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_user_id: userA.id, p_action_type: "test_action", p_max_count: 3, p_window_seconds: 60,
    });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });

  it("tracks different action types independently", async () => {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_user_id: userA.id, p_action_type: "different_action", p_max_count: 3, p_window_seconds: 60,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });

  it("tracks different users independently", async () => {
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_user_id: userB.id, p_action_type: "test_action", p_max_count: 3, p_window_seconds: 60,
    });
    expect(error).toBeNull();
    expect(data).toBe(true);
  });
});

describe("LIVE: rate limit trigger on comments (real limit: 30/hour)", () => {
  it("allows up to the configured limit of real comments", async () => {
    for (let i = 0; i < 30; i++) {
      const { error } = await commenterClient.from("comments")
        .insert({ spot_id: spotId, user_id: userA.id, text: `comment ${i}` });
      expect(error).toBeNull();
    }
  }, 15_000);

  it("rejects the 31st comment within the same hour", async () => {
    const { error } = await commenterClient.from("comments")
      .insert({ spot_id: spotId, user_id: userA.id, text: "one too many" });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Rate limit exceeded");
  });
});