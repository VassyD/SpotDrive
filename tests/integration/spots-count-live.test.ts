// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: profiles.spots_count
 *
 * Verifies the real, atomically-maintained spots_count column — this
 * column never existed before, so every "Spots" stat displayed anywhere
 * in the app always silently showed 0 regardless of real post count.
 *
 * Run with:
 *   npx vitest run tests/integration/spots-count-live.test.ts
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
  const email = `spotscount-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `sc_${label}_${Date.now()}`, display_name: label },
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
  return { id: data.user.id, email };
}

let owner: { id: string; email: string };
let spotIds: string[] = [];

beforeAll(async () => {
  owner = await createTestUser("owner");
}, 15_000);

afterAll(async () => {
  await admin.from("spots").delete().in("id", spotIds);
  await admin.from("profiles").delete().eq("id", owner.id);
  await admin.auth.admin.deleteUser(owner.id);
});

async function getSpotsCount() {
  const { data } = await admin.from("profiles").select("spots_count").eq("id", owner.id).single();
  return data?.spots_count;
}

describe("LIVE: profiles.spots_count", () => {
  it("starts at 0", async () => {
    expect(await getSpotsCount()).toBe(0);
  });

  it("increments when a live spot is inserted", async () => {
    const { data, error } = await admin.from("spots")
      .insert({ user_id: owner.id, make: "Test", model: "Count1", status: "live" })
      .select().single();
    expect(error).toBeNull();
    spotIds.push(data!.id);
    expect(await getSpotsCount()).toBe(1);
  });

  it("does NOT count a spot inserted with hidden status", async () => {
    const { data, error } = await admin.from("spots")
      .insert({ user_id: owner.id, make: "Test", model: "Count2Hidden", status: "hidden" })
      .select().single();
    expect(error).toBeNull();
    spotIds.push(data!.id);
    expect(await getSpotsCount()).toBe(1); // unchanged — still only 1 live
  });

  it("increments when a spot's status changes from hidden to live", async () => {
    const hiddenSpotId = spotIds[1];
    const { error } = await admin.from("spots").update({ status: "live" }).eq("id", hiddenSpotId);
    expect(error).toBeNull();
    expect(await getSpotsCount()).toBe(2);
  });

  it("decrements when a spot's status changes from live to hidden", async () => {
    const spotId = spotIds[0];
    const { error } = await admin.from("spots").update({ status: "hidden" }).eq("id", spotId);
    expect(error).toBeNull();
    expect(await getSpotsCount()).toBe(1);
  });

  it("decrements when a live spot is deleted", async () => {
    const liveSpotId = spotIds[1]; // this one is currently live
    const { error } = await admin.from("spots").delete().eq("id", liveSpotId);
    expect(error).toBeNull();
    spotIds = spotIds.filter(id => id !== liveSpotId);
    expect(await getSpotsCount()).toBe(0);
  });
});
