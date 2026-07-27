// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Tier 1 security hardening
 * (spots status visibility, storage upload ownership,
 *  comments shadow-ban visibility, spot_media coverage)
 *
 * Run with:
 *   npx vitest run tests/integration/tier1-security-hardening-live.test.ts
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
  const handle = `t1_${label}_${Date.now()}`;
  const email = `t1-${label}-${Date.now()}@example.com`;
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

let owner: { id: string; email: string; handle: string };
let admin_user: { id: string; email: string; handle: string };
let viewer: { id: string; email: string; handle: string };
let clientOwner: ReturnType<typeof createClient>;
let clientAdmin: ReturnType<typeof createClient>;
let clientViewer: ReturnType<typeof createClient>;
let liveSpotId: string;
let hiddenSpotId: string;
let mediaOnHiddenSpotId: string;
let shadowBannedUser: { id: string; email: string; handle: string };
let clientShadowBanned: ReturnType<typeof createClient>;
let commentByShadowBanned: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  admin_user = await createTestUser("admin");
  viewer = await createTestUser("viewer");
  shadowBannedUser = await createTestUser("shadow");

  clientOwner = await signInAs(owner.email);
  clientAdmin = await signInAs(admin_user.email);
  clientViewer = await signInAs(viewer.email);
  clientShadowBanned = await signInAs(shadowBannedUser.email);

  await admin.from("profiles").update({ is_admin: true }).eq("id", admin_user.id);
  await admin.from("profiles").update({ is_shadow_banned: true }).eq("id", shadowBannedUser.id);

  const { data: live } = await admin.from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "Live", status: "live" })
    .select().single();
  liveSpotId = live!.id;

  const { data: hidden } = await admin.from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "Hidden", status: "hidden" })
    .select().single();
  hiddenSpotId = hidden!.id;

  const { data: media } = await admin.from("spot_media")
    .insert({ spot_id: hiddenSpotId, user_id: owner.id, media_url: "https://example.com/x.jpg", media_type: "image", position: 0 })
    .select().single();
  mediaOnHiddenSpotId = media!.id;

  const { data: comment } = await admin.from("comments")
    .insert({ spot_id: liveSpotId, user_id: shadowBannedUser.id, text: "test comment" })
    .select().single();
  commentByShadowBanned = comment!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("comments").delete().eq("id", commentByShadowBanned);
  await admin.from("spot_media").delete().eq("id", mediaOnHiddenSpotId);
  await admin.from("spots").delete().in("id", [liveSpotId, hiddenSpotId]);
  await admin.from("profiles").delete().in("id", [owner.id, admin_user.id, viewer.id, shadowBannedUser.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(admin_user.id);
  await admin.auth.admin.deleteUser(viewer.id);
  await admin.auth.admin.deleteUser(shadowBannedUser.id);
});

describe("LIVE: spots status visibility", () => {
  it("hides a hidden spot from an unrelated viewer", async () => {
    const { data } = await clientViewer.from("spots").select("id").eq("id", hiddenSpotId);
    expect(data?.length ?? 0).toBe(0);
  });
  it("still shows the hidden spot to its own owner", async () => {
    const { data } = await clientOwner.from("spots").select("id").eq("id", hiddenSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
  it("still shows the hidden spot to an admin", async () => {
    const { data } = await clientAdmin.from("spots").select("id").eq("id", hiddenSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
  it("shows a live spot to everyone as normal", async () => {
    const { data } = await clientViewer.from("spots").select("id").eq("id", liveSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: spot_media coverage", () => {
  it("hides media belonging to a hidden spot from an unrelated viewer", async () => {
    const { data } = await clientViewer.from("spot_media").select("id").eq("id", mediaOnHiddenSpotId);
    expect(data?.length ?? 0).toBe(0);
  });
  it("still shows that media to its owner", async () => {
    const { data } = await clientOwner.from("spot_media").select("id").eq("id", mediaOnHiddenSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
  it("still shows that media to an admin", async () => {
    const { data } = await clientAdmin.from("spot_media").select("id").eq("id", mediaOnHiddenSpotId);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: comments shadow-ban visibility", () => {
  it("hides a shadow-banned user's comment from other users", async () => {
    const { data } = await clientViewer.from("comments").select("id").eq("id", commentByShadowBanned);
    expect(data?.length ?? 0).toBe(0);
  });
  it("still shows the shadow-banned user their own comment", async () => {
    const { data } = await clientShadowBanned.from("comments").select("id").eq("id", commentByShadowBanned);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: storage upload ownership", () => {
  it("allows uploading into your own spots folder", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientOwner.storage
      .from("spot-photos")
      .upload(`spots/${owner.id}/${liveSpotId}/test-own.jpg`, file, { upsert: true });
    expect(error).toBeNull();
  });

  it("blocks uploading into someone else's spots folder", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientViewer.storage
      .from("spot-photos")
      .upload(`spots/${owner.id}/${liveSpotId}/test-attack.jpg`, file, { upsert: true });
    expect(error).not.toBeNull();
  });

  it("blocks overwriting someone else's avatar", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientViewer.storage
      .from("spot-photos")
      .upload(`avatars/${owner.id}.jpg`, file, { upsert: true });
    expect(error).not.toBeNull();
  });

  it("allows uploading your own avatar", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientViewer.storage
      .from("spot-photos")
      .upload(`avatars/${viewer.id}.jpg`, file, { upsert: true });
    expect(error).toBeNull();
  });
});
