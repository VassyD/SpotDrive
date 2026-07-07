// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Notifications
 *
 * Run with:
 *   npx vitest run tests/integration/notifications-live.test.ts
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
  const email = `notif-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `notif_${label}_${Date.now()}`, display_name: label },
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
let actor: { id: string; email: string };
let ownerClient: ReturnType<typeof createClient>;
let actorClient: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  actor = await createTestUser("actor");
  ownerClient = await signInAs(owner.email);
  actorClient = await signInAs(actor.email);

  const { data: spot, error } = await admin
    .from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "NotifTest", status: "live" })
    .select().single();
  if (error || !spot) throw new Error(`Failed to create test spot: ${error?.message}`);
  spotId = spot.id;
}, 20_000);

afterAll(async () => {
  await admin.from("notifications").delete().eq("spot_id", spotId);
  await admin.from("notifications").delete().eq("user_id", owner.id).eq("type", "follow");
  await admin.from("likes").delete().eq("spot_id", spotId);
  await admin.from("saves").delete().eq("spot_id", spotId);
  await admin.from("comments").delete().eq("spot_id", spotId);
  await admin.from("follows").delete().eq("follower_id", actor.id);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [owner.id, actor.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(actor.id);
});

async function getOwnerNotifs(type: string) {
  const { data } = await ownerClient.from("notifications")
    .select("*").eq("user_id", owner.id).eq("type", type);
  return data || [];
}

describe("LIVE: notifications", () => {
  it("creates a like notification for the spot owner", async () => {
    const { error } = await actorClient.from("likes").insert({ spot_id: spotId, user_id: actor.id });
    expect(error).toBeNull();
    const notifs = await getOwnerNotifs("like");
    expect(notifs.length).toBe(1);
    expect(notifs[0].actor_id).toBe(actor.id);
  });

  it("creates a save notification for the spot owner", async () => {
    const { error } = await actorClient.from("saves").insert({ spot_id: spotId, user_id: actor.id });
    expect(error).toBeNull();
    const notifs = await getOwnerNotifs("save");
    expect(notifs.length).toBe(1);
  });

  it("creates a comment notification with the comment text", async () => {
    const { error } = await actorClient.from("comments")
      .insert({ spot_id: spotId, user_id: actor.id, text: "nice find!" });
    expect(error).toBeNull();
    const notifs = await getOwnerNotifs("comment");
    expect(notifs.length).toBe(1);
    expect(notifs[0].comment_text).toBe("nice find!");
  });

  it("creates a follow notification for the person being followed", async () => {
    const { error } = await actorClient.from("follows")
      .insert({ follower_id: actor.id, following_id: owner.id });
    expect(error).toBeNull();
    const notifs = await getOwnerNotifs("follow");
    expect(notifs.length).toBe(1);
  });

  it("does NOT notify when the owner likes their own spot", async () => {
    const before = (await getOwnerNotifs("like")).length;
    await ownerClient.from("likes").insert({ spot_id: spotId, user_id: owner.id });
    const after = (await getOwnerNotifs("like")).length;
    expect(after).toBe(before); // unchanged — no self-notification
  });

  it("prevents a user from reading someone else's notifications", async () => {
    const { data, error } = await actorClient.from("notifications")
      .select("*").eq("user_id", owner.id);
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // RLS hides them
  });

  it("allows the owner to mark their own notification as read", async () => {
    const notifs = await getOwnerNotifs("like");
    const { error } = await ownerClient.from("notifications")
      .update({ read: true }).eq("id", notifs[0].id);
    expect(error).toBeNull();
    const { data } = await ownerClient.from("notifications").select("read").eq("id", notifs[0].id).single();
    expect(data?.read).toBe(true);
  });
});
