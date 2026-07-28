// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Private Account (follow requests + content visibility)
 *
 * Run with:
 *   npx vitest run tests/integration/private-account-live.test.ts
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
  const handle = `priv2_${label}_${Date.now()}`;
  const email = `priv2-${label}-${Date.now()}@example.com`;
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

let ownerPrivate: { id: string; email: string; handle: string };
let follower: { id: string; email: string; handle: string };
let requester: { id: string; email: string; handle: string };
let blocked: { id: string; email: string; handle: string };
let thirdParty: { id: string; email: string; handle: string };
let adminUser: { id: string; email: string; handle: string };
let ownerPublic: { id: string; email: string; handle: string };

let clientOwnerPrivate: ReturnType<typeof createClient>;
let clientFollower: ReturnType<typeof createClient>;
let clientRequester: ReturnType<typeof createClient>;
let clientBlocked: ReturnType<typeof createClient>;
let clientThirdParty: ReturnType<typeof createClient>;
let clientAdmin: ReturnType<typeof createClient>;

let privateSpotId: string;
let privateStoryId: string;
let privateMediaId: string;
let publicSpotId: string;

beforeAll(async () => {
  ownerPrivate = await createTestUser("owner");
  follower = await createTestUser("follower");
  requester = await createTestUser("requester");
  blocked = await createTestUser("blocked");
  thirdParty = await createTestUser("third");
  adminUser = await createTestUser("admin");
  ownerPublic = await createTestUser("public");

  clientOwnerPrivate = await signInAs(ownerPrivate.email);
  clientFollower = await signInAs(follower.email);
  clientRequester = await signInAs(requester.email);
  clientBlocked = await signInAs(blocked.email);
  clientThirdParty = await signInAs(thirdParty.email);
  clientAdmin = await signInAs(adminUser.email);

  await admin.from("profiles").update({ is_private: true }).eq("id", ownerPrivate.id);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
  await admin.from("follows").insert({ follower_id: follower.id, following_id: ownerPrivate.id });
  await admin.from("blocks").insert({ blocker_id: ownerPrivate.id, blocked_id: blocked.id });

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: ownerPrivate.id, make: "Test", model: "PrivateSpot", status: "live" })
    .select().single();
  privateSpotId = spot!.id;

  const { data: story } = await admin.from("stories")
    .insert({ user_id: ownerPrivate.id, image_url: "https://example.com/s.jpg", expires_at: new Date(Date.now() + 3600_000).toISOString() })
    .select().single();
  privateStoryId = story!.id;

  const { data: media } = await admin.from("spot_media")
    .insert({ spot_id: privateSpotId, user_id: ownerPrivate.id, media_url: "https://example.com/m.jpg", media_type: "image", position: 0 })
    .select().single();
  privateMediaId = media!.id;

  const { data: pubSpot } = await admin.from("spots")
    .insert({ user_id: ownerPublic.id, make: "Test", model: "PublicSpot", status: "live" })
    .select().single();
  publicSpotId = pubSpot!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("follow_requests").delete().or(`requester_id.eq.${requester.id},target_id.eq.${ownerPrivate.id}`);
  await admin.from("follows").delete().or(`follower_id.eq.${follower.id},follower_id.eq.${requester.id}`);
  await admin.from("blocks").delete().eq("blocker_id", ownerPrivate.id);
  await admin.from("spot_media").delete().eq("id", privateMediaId);
  await admin.from("stories").delete().eq("id", privateStoryId);
  await admin.from("spots").delete().in("id", [privateSpotId, publicSpotId]);
  const ids = [ownerPrivate.id, follower.id, requester.id, blocked.id, thirdParty.id, adminUser.id, ownerPublic.id];
  await admin.from("profiles").delete().in("id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

describe("LIVE: follow requests - creation and constraints", () => {
  it("rejects requesting to follow a non-private account (should be an instant follow instead)", async () => {
    const { error } = await clientRequester.from("follow_requests")
      .insert({ requester_id: requester.id, target_id: ownerPublic.id });
    expect(error).not.toBeNull();
  });

  it("allows requesting to follow a private account", async () => {
    const { error } = await clientRequester.from("follow_requests")
      .insert({ requester_id: requester.id, target_id: ownerPrivate.id });
    expect(error).toBeNull();
  });

  it("rejects a duplicate request", async () => {
    const { error } = await clientRequester.from("follow_requests")
      .insert({ requester_id: requester.id, target_id: ownerPrivate.id });
    expect(error).not.toBeNull();
  });

  it("rejects a self-request", async () => {
    const { error } = await admin.from("follow_requests")
      .insert({ requester_id: ownerPrivate.id, target_id: ownerPrivate.id });
    expect(error).not.toBeNull();
  });

  it("blocks requesting to follow a blocked user", async () => {
    const { error } = await clientBlocked.from("follow_requests")
      .insert({ requester_id: blocked.id, target_id: ownerPrivate.id });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: follow requests - visibility", () => {
  it("the requester and target can both see the request", async () => {
    const { data: seesRequester } = await clientRequester.from("follow_requests")
      .select("id").eq("requester_id", requester.id).eq("target_id", ownerPrivate.id);
    const { data: seesTarget } = await clientOwnerPrivate.from("follow_requests")
      .select("id").eq("requester_id", requester.id).eq("target_id", ownerPrivate.id);
    expect(seesRequester?.length ?? 0).toBe(1);
    expect(seesTarget?.length ?? 0).toBe(1);
  });

  it("an uninvolved third party cannot see the request", async () => {
    const { data } = await clientThirdParty.from("follow_requests")
      .select("id").eq("requester_id", requester.id).eq("target_id", ownerPrivate.id);
    expect(data?.length ?? 0).toBe(0);
  });
});

describe("LIVE: accepting a request", () => {
  let requestId: string;

  beforeAll(async () => {
    const { data } = await admin.from("follow_requests")
      .select("id").eq("requester_id", requester.id).eq("target_id", ownerPrivate.id).single();
    requestId = data!.id;
  });

  it("the requester cannot accept their own request", async () => {
    const { error } = await clientRequester.rpc("accept_follow_request", { request_id: requestId });
    expect(error).not.toBeNull();
  });

  it("an uninvolved third party cannot accept it", async () => {
    const { error } = await clientThirdParty.rpc("accept_follow_request", { request_id: requestId });
    expect(error).not.toBeNull();
  });

  it("the target accepting creates a real follow and removes the request", async () => {
    const { error } = await clientOwnerPrivate.rpc("accept_follow_request", { request_id: requestId });
    expect(error).toBeNull();

    const { data: followRow } = await admin.from("follows")
      .select("id").eq("follower_id", requester.id).eq("following_id", ownerPrivate.id);
    expect(followRow?.length ?? 0).toBe(1);

    const { data: reqRow } = await admin.from("follow_requests").select("id").eq("id", requestId);
    expect(reqRow?.length ?? 0).toBe(0);
  });
});

describe("LIVE: private content visibility", () => {
  it("the owner can see their own private spot/story/media", async () => {
    const { data: s } = await clientOwnerPrivate.from("spots").select("id").eq("id", privateSpotId);
    const { data: st } = await clientOwnerPrivate.from("stories").select("id").eq("id", privateStoryId);
    const { data: m } = await clientOwnerPrivate.from("spot_media").select("id").eq("id", privateMediaId);
    expect(s?.length ?? 0).toBe(1);
    expect(st?.length ?? 0).toBe(1);
    expect(m?.length ?? 0).toBe(1);
  });

  it("an admin can see the private content", async () => {
    const { data: s } = await clientAdmin.from("spots").select("id").eq("id", privateSpotId);
    expect(s?.length ?? 0).toBe(1);
  });

  it("a non-follower cannot see the private spot/story/media", async () => {
    const { data: s } = await clientThirdParty.from("spots").select("id").eq("id", privateSpotId);
    const { data: st } = await clientThirdParty.from("stories").select("id").eq("id", privateStoryId);
    const { data: m } = await clientThirdParty.from("spot_media").select("id").eq("id", privateMediaId);
    expect(s?.length ?? 0).toBe(0);
    expect(st?.length ?? 0).toBe(0);
    expect(m?.length ?? 0).toBe(0);
  });

  it("an already-accepted follower CAN see the private spot/story/media", async () => {
    const { data: s } = await clientFollower.from("spots").select("id").eq("id", privateSpotId);
    const { data: st } = await clientFollower.from("stories").select("id").eq("id", privateStoryId);
    const { data: m } = await clientFollower.from("spot_media").select("id").eq("id", privateMediaId);
    expect(s?.length ?? 0).toBe(1);
    expect(st?.length ?? 0).toBe(1);
    expect(m?.length ?? 0).toBe(1);
  });

  it("a newly-accepted follower (via the RPC) can now also see it", async () => {
    const { data: s } = await clientRequester.from("spots").select("id").eq("id", privateSpotId);
    expect(s?.length ?? 0).toBe(1);
  });

  it("a non-private account's content is unaffected (regression check)", async () => {
    const { data: s } = await clientThirdParty.from("spots").select("id").eq("id", publicSpotId);
    expect(s?.length ?? 0).toBe(1);
  });
});
