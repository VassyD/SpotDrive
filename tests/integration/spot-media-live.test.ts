// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: spot_media (multi-photo + video)
 *
 * Run with:
 *   npx vitest run tests/integration/spot-media-live.test.ts
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
  const email = `media-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `media_${label}_${Date.now()}`, display_name: label },
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
let other: { id: string; email: string };
let ownerClient: ReturnType<typeof createClient>;
let otherClient: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  other = await createTestUser("other");
  ownerClient = await signInAs(owner.email);
  otherClient = await signInAs(other.email);

  const { data: spot, error } = await admin
    .from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "MediaTest", status: "live" })
    .select().single();
  if (error || !spot) throw new Error(`Failed to create test spot: ${error?.message}`);
  spotId = spot.id;
}, 20_000);

afterAll(async () => {
  await admin.from("spot_media").delete().eq("spot_id", spotId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [owner.id, other.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(other.id);
});

describe("LIVE: spot_media photos", () => {
  it("allows the owner to add up to 4 photos", async () => {
    for (let i = 0; i < 4; i++) {
      const { error } = await ownerClient.from("spot_media").insert({
        spot_id: spotId, user_id: owner.id,
        media_url: `https://example.com/photo${i}.jpg`, media_type: "image", position: i,
      });
      expect(error).toBeNull();
    }
  });

  it("rejects a 5th photo", async () => {
    const { error } = await ownerClient.from("spot_media").insert({
      spot_id: spotId, user_id: owner.id,
      media_url: "https://example.com/photo5.jpg", media_type: "image", position: 4,
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: spot_media video", () => {
  it("allows the owner to add exactly one video", async () => {
    const { error } = await ownerClient.from("spot_media").insert({
      spot_id: spotId, user_id: owner.id,
      media_url: "https://example.com/clip.mp4", media_type: "video", position: 5,
    });
    expect(error).toBeNull();
  });

  it("rejects a 2nd video", async () => {
    const { error } = await ownerClient.from("spot_media").insert({
      spot_id: spotId, user_id: owner.id,
      media_url: "https://example.com/clip2.mp4", media_type: "video", position: 6,
    });
    expect(error).not.toBeNull();
  });
});

describe("LIVE: spot_media ownership", () => {
  it("prevents a different user from adding media to someone else's spot", async () => {
    const { error } = await otherClient.from("spot_media").insert({
      spot_id: spotId, user_id: other.id,
      media_url: "https://example.com/intruder.jpg", media_type: "image", position: 0,
    });
    expect(error).not.toBeNull();
  });

  it("prevents inserting media claiming another user as the uploader", async () => {
    const { error } = await ownerClient.from("spot_media").insert({
      spot_id: spotId, user_id: other.id, // claiming to be someone else
      media_url: "https://example.com/spoof.jpg", media_type: "image", position: 0,
    });
    expect(error).not.toBeNull();
  });

  it("allows anyone (including a different user) to view the media", async () => {
    const { data, error } = await otherClient.from("spot_media").select("*").eq("spot_id", spotId);
    expect(error).toBeNull();
    expect((data?.length ?? 0)).toBeGreaterThan(0);
  });

  it("prevents a different user from deleting the owner's media", async () => {
    const { data: media } = await admin.from("spot_media").select("id").eq("spot_id", spotId).limit(1).single();
    const { data, error } = await otherClient.from("spot_media").delete().eq("id", media!.id).select();
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // RLS silently blocks, not an explicit error
  });

  it("allows the owner to delete their own media", async () => {
    const { data: media } = await admin.from("spot_media").select("id").eq("spot_id", spotId).limit(1).single();
    const { error } = await ownerClient.from("spot_media").delete().eq("id", media!.id);
    expect(error).toBeNull();
  });
});
