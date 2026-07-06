// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Reporting Comments and Users
 *
 * Run with:
 *   npx vitest run tests/integration/reports-targets-live.test.ts
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
  const email = `rpt-target-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `rt_${label}_${Date.now()}`, display_name: label },
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
let reporter: { id: string; email: string };
let ownerClient: ReturnType<typeof createClient>;
let reporterClient: ReturnType<typeof createClient>;
let spotId: string;
let commentId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  reporter = await createTestUser("reporter");
  ownerClient = await signInAs(owner.email);
  reporterClient = await signInAs(reporter.email);

  const { data: spot, error: spotErr } = await admin
    .from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "TargetTest", status: "live" })
    .select().single();
  if (spotErr || !spot) throw new Error(`Failed to create test spot: ${spotErr?.message}`);
  spotId = spot.id;

  const { data: comment, error: commentErr } = await ownerClient
    .from("comments")
    .insert({ spot_id: spotId, user_id: owner.id, text: "test comment to report" })
    .select().single();
  if (commentErr || !comment) throw new Error(`Failed to create test comment: ${commentErr?.message}`);
  commentId = comment.id;
}, 30_000);

afterAll(async () => {
  await admin.from("reports").delete().or(`comment_id.eq.${commentId},reported_user_id.eq.${owner.id}`);
  await admin.from("comments").delete().eq("id", commentId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [owner.id, reporter.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(reporter.id);
});

describe("LIVE: reporting comments", () => {
  it("allows reporting a comment", async () => {
    const { error } = await reporterClient.from("reports").insert({
      comment_id: commentId, reporter_id: reporter.id, reason: "Harassment",
    });
    expect(error).toBeNull();
  });

  it("prevents the same user from reporting the same comment twice", async () => {
    const { error } = await reporterClient.from("reports").insert({
      comment_id: commentId, reporter_id: reporter.id, reason: "Trying again",
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: reporting users", () => {
  it("allows reporting a user directly", async () => {
    const { error } = await reporterClient.from("reports").insert({
      reported_user_id: owner.id, reporter_id: reporter.id, reason: "Suspicious profile",
    });
    expect(error).toBeNull();
  });

  it("prevents the same user from reporting the same user twice", async () => {
    const { error } = await reporterClient.from("reports").insert({
      reported_user_id: owner.id, reporter_id: reporter.id, reason: "Trying again",
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: exactly-one-target constraint", () => {
  it("rejects a report with no target at all", async () => {
    const { error } = await reporterClient.from("reports").insert({
      reporter_id: reporter.id, reason: "No target",
    });
    expect(error).not.toBeNull();
  });

  it("rejects a report with more than one target", async () => {
    const { error } = await reporterClient.from("reports").insert({
      spot_id: spotId, comment_id: commentId, reporter_id: reporter.id, reason: "Two targets",
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: spot reporting still works (regression check)", () => {
  it("allows reporting a spot as before", async () => {
    const { error } = await reporterClient.from("reports").insert({
      spot_id: spotId, reporter_id: reporter.id, reason: "Spam",
    });
    expect(error).toBeNull();
  });
});
