// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Profile visibility between blocked users
 *
 * Run with:
 *   npx vitest run tests/integration/profiles-block-visibility-live.test.ts
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
  const handle = `pblock_${label}_${Date.now()}`;
  const email = `pblock-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle, display_name: label },
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
  return { id: data.user.id, email, handle };
}

async function signInAs(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  return client;
}

let userA: { id: string; email: string; handle: string }; // the blocker
let userB: { id: string; email: string; handle: string }; // the blocked
let userC: { id: string; email: string; handle: string }; // uninvolved third party
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let clientC: ReturnType<typeof createClient>;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  userC = await createTestUser("c");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  clientC = await signInAs(userC.email);

  // A blocks B beforehand
  await admin.from("blocks").insert({ blocker_id: userA.id, blocked_id: userB.id });
}, 20_000);

afterAll(async () => {
  await admin.from("blocks").delete().eq("blocker_id", userA.id);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, userC.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
});

describe("LIVE: profiles - block visibility", () => {
  it("hides the blocked user's profile from the blocker by direct id lookup", async () => {
    const { data } = await clientA.from("profiles").select("id").eq("id", userB.id);
    expect(data?.length ?? 0).toBe(0);
  });

  it("hides the blocked user's profile from the blocker via search (handle lookup)", async () => {
    const { data } = await clientA.from("profiles").select("id").ilike("handle", `%${userB.handle}%`);
    expect(data?.length ?? 0).toBe(0);
  });

  it("hides the blocker's profile from the blocked user (mutual)", async () => {
    const { data } = await clientB.from("profiles").select("id").eq("id", userA.id);
    expect(data?.length ?? 0).toBe(0);
  });

  it("does NOT hide either user's profile from an uninvolved third party", async () => {
    const { data: seesA } = await clientC.from("profiles").select("id").eq("id", userA.id);
    const { data: seesB } = await clientC.from("profiles").select("id").eq("id", userB.id);
    expect(seesA?.length ?? 0).toBe(1);
    expect(seesB?.length ?? 0).toBe(1);
  });

  it("restores visibility after unblocking", async () => {
    await clientA.from("blocks").delete().eq("blocker_id", userA.id).eq("blocked_id", userB.id);
    const { data } = await clientA.from("profiles").select("id").eq("id", userB.id);
    expect(data?.length ?? 0).toBe(1);
  });
});
