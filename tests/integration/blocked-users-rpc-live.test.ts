// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: get_my_blocked_users RPC
 *
 * Run with:
 *   npx vitest run tests/integration/blocked-users-rpc-live.test.ts
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
  const handle = `bprpc_${label}_${Date.now()}`;
  const email = `bprpc-${label}-${Date.now()}@example.com`;
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
let blockId: string;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  userC = await createTestUser("c");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  clientC = await signInAs(userC.email);

  const { data } = await admin.from("blocks")
    .insert({ blocker_id: userA.id, blocked_id: userB.id })
    .select().single();
  blockId = data!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("blocks").delete().eq("blocker_id", userA.id);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, userC.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
});

describe("LIVE: get_my_blocked_users RPC", () => {
  it("returns the blocked user's real handle to the blocker, despite the profiles RLS block", async () => {
    const { data, error } = await clientA.rpc("get_my_blocked_users");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(1);
    expect(data[0].block_id).toBe(blockId);
    expect(data[0].blocked_id).toBe(userB.id);
    expect(data[0].handle).toBe(userB.handle);
  });

  it("does NOT return anything for the blocked user (they didn't block anyone)", async () => {
    const { data, error } = await clientB.rpc("get_my_blocked_users");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it("does NOT return anything for an uninvolved third party", async () => {
    const { data, error } = await clientC.rpc("get_my_blocked_users");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0);
  });

  it("returns nothing after unblocking", async () => {
    await clientA.from("blocks").delete().eq("id", blockId);
    const { data } = await clientA.rpc("get_my_blocked_users");
    expect(data?.length ?? 0).toBe(0);
  });
});
