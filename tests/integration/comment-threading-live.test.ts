// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Comment threading
 *
 * Run with:
 *   npx vitest run tests/integration/comment-threading-live.test.ts
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
  const email = `cthread-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `cthread_${label}_${Date.now()}`, display_name: label },
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
let commenter: { id: string; email: string };
let replier: { id: string; email: string };
let ownerClient: ReturnType<typeof createClient>;
let commenterClient: ReturnType<typeof createClient>;
let replierClient: ReturnType<typeof createClient>;
let spotId: string;
let otherSpotId: string;
let topCommentId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  commenter = await createTestUser("commenter");
  replier = await createTestUser("replier");
  ownerClient = await signInAs(owner.email);
  commenterClient = await signInAs(commenter.email);
  replierClient = await signInAs(replier.email);

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "ThreadTest", status: "live" })
    .select().single();
  spotId = spot!.id;

  const { data: otherSpot } = await admin.from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "OtherSpot", status: "live" })
    .select().single();
  otherSpotId = otherSpot!.id;

  const { data: comment } = await commenterClient.from("comments")
    .insert({ spot_id: spotId, user_id: commenter.id, text: "top level comment" })
    .select().single();
  topCommentId = comment!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("comments").delete().eq("spot_id", spotId);
  await admin.from("notifications").delete().in("spot_id", [spotId, otherSpotId]);
  await admin.from("spots").delete().in("id", [spotId, otherSpotId]);
  await admin.from("profiles").delete().in("id", [owner.id, commenter.id, replier.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(commenter.id);
  await admin.auth.admin.deleteUser(replier.id);
});

describe("LIVE: comment threading", () => {
  it("allows replying to a top-level comment", async () => {
    const { data, error } = await replierClient.from("comments")
      .insert({ spot_id: spotId, user_id: replier.id, text: "a reply", parent_comment_id: topCommentId })
      .select().single();
    expect(error).toBeNull();
    expect(data?.parent_comment_id).toBe(topCommentId);
  });

  it("rejects a reply whose parent belongs to a different spot", async () => {
    const { error } = await replierClient.from("comments")
      .insert({ spot_id: otherSpotId, user_id: replier.id, text: "cross-spot reply", parent_comment_id: topCommentId });
    expect(error).not.toBeNull();
  });

  it("notifies the parent comment's author when someone replies", async () => {
    const { data } = await admin.from("notifications")
      .select("*").eq("user_id", commenter.id).eq("type", "comment").eq("actor_id", replier.id);
    expect((data?.length ?? 0)).toBeGreaterThan(0);
  });

  it("does not double-notify when the parent author is also the spot owner", async () => {
    const { data: ownerComment } = await ownerClient.from("comments")
      .insert({ spot_id: spotId, user_id: owner.id, text: "owner's own comment" })
      .select().single();

    await replierClient.from("comments")
      .insert({ spot_id: spotId, user_id: replier.id, text: "reply to owner", parent_comment_id: ownerComment!.id });

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", owner.id).eq("actor_id", replier.id).eq("comment_text", "reply to owner");
    expect(notifs?.length ?? 0).toBe(1); // exactly one, not two
  });

  it("deleting a top-level comment cascades to delete its replies", async () => {
    const { data: parent } = await commenterClient.from("comments")
      .insert({ spot_id: spotId, user_id: commenter.id, text: "will be deleted" })
      .select().single();
    const { data: childReply } = await replierClient.from("comments")
      .insert({ spot_id: spotId, user_id: replier.id, text: "child reply", parent_comment_id: parent!.id })
      .select().single();

    await commenterClient.from("comments").delete().eq("id", parent!.id);

    const { data: check } = await admin.from("comments").select("id").eq("id", childReply!.id);
    expect(check?.length ?? 0).toBe(0);
  });
});