// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Show Location enforcement (spots_with_location_privacy view)
 *
 * Run with:
 *   npx vitest run tests/integration/location-privacy-live.test.ts
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
  const handle = `loc_${label}_${Date.now()}`;
  const email = `loc-${label}-${Date.now()}@example.com`;
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

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let ownerHidden: { id: string; email: string; handle: string };
let ownerVisible: { id: string; email: string; handle: string };
let follower: { id: string; email: string; handle: string };
let nonFollower: { id: string; email: string; handle: string };
let adminUser: { id: string; email: string; handle: string };
let blocked: { id: string; email: string; handle: string };
let shadowBanned: { id: string; email: string; handle: string };
let privateOwner: { id: string; email: string; handle: string };
let privateFollower: { id: string; email: string; handle: string };

let clientOwnerHidden: ReturnType<typeof createClient>;
let clientAdmin: ReturnType<typeof createClient>;
let clientFollower: ReturnType<typeof createClient>;
let clientNonFollower: ReturnType<typeof createClient>;
let clientBlocked: ReturnType<typeof createClient>;
let clientPrivateFollower: ReturnType<typeof createClient>;

let hiddenSpotId: string;
let visibleSpotId: string;
let blockedSpotId: string;
let shadowSpotId: string;
let hiddenStatusSpotId: string;
let privateSpotId: string;

beforeAll(async () => {
  ownerHidden = await createTestUser("hidden");
  ownerVisible = await createTestUser("visible");
  follower = await createTestUser("follower");
  nonFollower = await createTestUser("nonfollower");
  adminUser = await createTestUser("admin");
  blocked = await createTestUser("blocked");
  shadowBanned = await createTestUser("shadow");
  privateOwner = await createTestUser("privowner");
  privateFollower = await createTestUser("privfollower");

  clientOwnerHidden = await signInAs(ownerHidden.email);
  clientAdmin = await signInAs(adminUser.email);
  clientFollower = await signInAs(follower.email);
  clientNonFollower = await signInAs(nonFollower.email);
  clientBlocked = await signInAs(blocked.email);
  clientPrivateFollower = await signInAs(privateFollower.email);

  await admin.from("profiles").update({ show_location: false }).eq("id", ownerHidden.id);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
  await admin.from("profiles").update({ is_shadow_banned: true }).eq("id", shadowBanned.id);
  await admin.from("profiles").update({ is_private: true }).eq("id", privateOwner.id);
  await admin.from("follows").insert({ follower_id: follower.id, following_id: ownerHidden.id });
  await admin.from("follows").insert({ follower_id: privateFollower.id, following_id: privateOwner.id });
  await admin.from("blocks").insert({ blocker_id: ownerHidden.id, blocked_id: blocked.id });

  const { data: s1 } = await admin.from("spots").insert({
    user_id: ownerHidden.id, make: "Test", model: "Hidden", status: "live", location_name: "Secret Garage",
  }).select().single();
  hiddenSpotId = s1!.id;

  const { data: s2 } = await admin.from("spots").insert({
    user_id: ownerVisible.id, make: "Test", model: "Visible", status: "live", location_name: "Public Street",
  }).select().single();
  visibleSpotId = s2!.id;

  const { data: s3 } = await admin.from("spots").insert({
    user_id: ownerHidden.id, make: "Test", model: "BlockedTest", status: "live", location_name: "Secret2",
  }).select().single();
  blockedSpotId = s3!.id;

  const { data: s4 } = await admin.from("spots").insert({
    user_id: shadowBanned.id, make: "Test", model: "ShadowTest", status: "live", location_name: "ShadowLoc",
  }).select().single();
  shadowSpotId = s4!.id;

  const { data: s5 } = await admin.from("spots").insert({
    user_id: ownerVisible.id, make: "Test", model: "HiddenStatus", status: "hidden", location_name: "HiddenStatusLoc",
  }).select().single();
  hiddenStatusSpotId = s5!.id;

  const { data: s6 } = await admin.from("spots").insert({
    user_id: privateOwner.id, make: "Test", model: "PrivateTest", status: "live", location_name: "PrivateLoc",
  }).select().single();
  privateSpotId = s6!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("spots").delete().in("id", [hiddenSpotId, visibleSpotId, blockedSpotId, shadowSpotId, hiddenStatusSpotId, privateSpotId]);
  await admin.from("follows").delete().or(`follower_id.eq.${follower.id},follower_id.eq.${privateFollower.id}`);
  await admin.from("blocks").delete().eq("blocker_id", ownerHidden.id);
  const ids = [ownerHidden.id, ownerVisible.id, follower.id, nonFollower.id, adminUser.id, blocked.id, shadowBanned.id, privateOwner.id, privateFollower.id];
  await admin.from("profiles").delete().in("id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

describe("LIVE: location privacy view - masking logic", () => {
  it("the owner sees their own location even when show_location is false", async () => {
    const { data, error } = await clientOwnerHidden.from("spots_with_location_privacy").select("location_name").eq("id", hiddenSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("Secret Garage");
  });

  it("an admin sees the location for a show_location=false spot", async () => {
    const { data, error } = await clientAdmin.from("spots_with_location_privacy").select("location_name").eq("id", hiddenSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("Secret Garage");
  });

  it("a follower sees the location for a show_location=false spot", async () => {
    const { data, error } = await clientFollower.from("spots_with_location_privacy").select("location_name").eq("id", hiddenSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("Secret Garage");
  });

  it("a non-follower does NOT see the location for a show_location=false spot (masked to null)", async () => {
    const { data, error } = await clientNonFollower.from("spots_with_location_privacy").select("location_name").eq("id", hiddenSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBeNull();
  });

  it("a non-follower DOES see the location when show_location is true (default, regression check)", async () => {
    const { data, error } = await clientNonFollower.from("spots_with_location_privacy").select("location_name").eq("id", visibleSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("Public Street");
  });
});

describe("LIVE: location privacy view - existing RLS regressions still apply", () => {
  it("a blocked user cannot see the spot row at all via the view", async () => {
    const { data } = await clientBlocked.from("spots_with_location_privacy").select("id").eq("id", blockedSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("a shadow-banned user's spot is hidden from others via the view", async () => {
    const { data } = await clientNonFollower.from("spots_with_location_privacy").select("id").eq("id", shadowSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("a non-live (hidden) spot is hidden from non-owners via the view", async () => {
    const { data } = await clientNonFollower.from("spots_with_location_privacy").select("id").eq("id", hiddenStatusSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("a private account's spot is hidden entirely from a non-follower via the view", async () => {
    const { data } = await clientNonFollower.from("spots_with_location_privacy").select("id").eq("id", privateSpotId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("a private account's spot (including location) IS visible to an approved follower", async () => {
    const { data, error } = await clientPrivateFollower.from("spots_with_location_privacy").select("id, location_name").eq("id", privateSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("PrivateLoc");
  });
});

describe("LIVE: view accessible to anon", () => {
  it("an unauthenticated client can query the view and see a public spot's location by default", async () => {
    const client = anonClient();
    const { data, error } = await client.from("spots_with_location_privacy").select("location_name").eq("id", visibleSpotId).single();
    expect(error).toBeNull();
    expect(data!.location_name).toBe("Public Street");
  });
});
