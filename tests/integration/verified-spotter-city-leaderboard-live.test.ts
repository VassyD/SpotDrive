// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Verified Spotter badge + City leaderboard
 *
 * Run with:
 *   npx vitest run tests/integration/verified-spotter-city-leaderboard-live.test.ts
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

async function createTestUser(label: string, town: string) {
  const handle = `vsc_${label}_${Date.now()}`;
  const email = `vsc-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle, display_name: label },
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);
  await admin.from("profile_private_info").update({ town }).eq("user_id", data.user.id);
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

describe("LIVE: Verified Spotter badge permanence", () => {
  let user: { id: string; email: string; handle: string };

  beforeAll(async () => {
    user = await createTestUser("badge", "BadgeTown");
  }, 20_000);

  afterAll(async () => {
    await admin.from("profiles").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id);
  });

  it("starts unverified", async () => {
    const { data } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    expect(data!.verified_spotter_at).toBeNull();
  });

  it("crossing 50 spots sets verified_spotter_at", async () => {
    await admin.from("profiles").update({ spots_count: 50 }).eq("id", user.id);
    const { data } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    expect(data!.verified_spotter_at).not.toBeNull();
  });

  it("dropping back below 50 does NOT unset it (permanence)", async () => {
    const { data: before } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    await admin.from("profiles").update({ spots_count: 10 }).eq("id", user.id);
    const { data: after } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    expect(after!.verified_spotter_at).toBe(before!.verified_spotter_at);
  });

  it("crossing 50 again does NOT reset the timestamp to a new value", async () => {
    const { data: before } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    await admin.from("profiles").update({ spots_count: 75 }).eq("id", user.id);
    const { data: after } = await admin.from("profiles").select("verified_spotter_at").eq("id", user.id).single();
    expect(after!.verified_spotter_at).toBe(before!.verified_spotter_at);
  });
});

describe("LIVE: City leaderboard", () => {
  let userA: { id: string; email: string; handle: string };
  let userB: { id: string; email: string; handle: string };
  let userOtherCity: { id: string; email: string; handle: string };
  let userBlocked: { id: string; email: string; handle: string };
  let userShadow: { id: string; email: string; handle: string };
  let clientA: ReturnType<typeof createClient>;
  const spotIds: string[] = [];

  beforeAll(async () => {
    userA = await createTestUser("a", "LeaderTown");
    userB = await createTestUser("b", "LeaderTown");
    userOtherCity = await createTestUser("other", "RivalTown");
    userBlocked = await createTestUser("blocked", "LeaderTown");
    userShadow = await createTestUser("shadow", "LeaderTown");
    clientA = await signInAs(userA.email);

    await admin.from("blocks").insert({ blocker_id: userA.id, blocked_id: userBlocked.id });
    await admin.from("profiles").update({ is_shadow_banned: true }).eq("id", userShadow.id);

    // userA: 1 spot this month
    const { data: sA } = await admin.from("spots").insert({
      user_id: userA.id, make: "Test", model: "A1", status: "live",
    }).select().single();
    spotIds.push(sA!.id);

    // userB: 2 spots this month (should rank higher)
    const { data: sB1 } = await admin.from("spots").insert({
      user_id: userB.id, make: "Test", model: "B1", status: "live",
    }).select().single();
    spotIds.push(sB1!.id);
    const { data: sB2 } = await admin.from("spots").insert({
      user_id: userB.id, make: "Test", model: "B2", status: "live",
    }).select().single();
    spotIds.push(sB2!.id);

    // userB: 1 spot from LAST month (should NOT count)
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const { data: sOld } = await admin.from("spots").insert({
      user_id: userB.id, make: "Test", model: "OldB", status: "live", created_at: lastMonth.toISOString(),
    }).select().single();
    spotIds.push(sOld!.id);

    // userB: 1 hidden (non-live) spot this month (should NOT count)
    const { data: sHidden } = await admin.from("spots").insert({
      user_id: userB.id, make: "Test", model: "HiddenB", status: "hidden",
    }).select().single();
    spotIds.push(sHidden!.id);

    // userOtherCity: 5 spots this month, but different city entirely
    const { data: sOther } = await admin.from("spots").insert({
      user_id: userOtherCity.id, make: "Test", model: "Other1", status: "live",
    }).select().single();
    spotIds.push(sOther!.id);

    // userBlocked and userShadow: 1 spot each this month
    const { data: sBlocked } = await admin.from("spots").insert({
      user_id: userBlocked.id, make: "Test", model: "Blocked1", status: "live",
    }).select().single();
    spotIds.push(sBlocked!.id);
    const { data: sShadow } = await admin.from("spots").insert({
      user_id: userShadow.id, make: "Test", model: "Shadow1", status: "live",
    }).select().single();
    spotIds.push(sShadow!.id);
  }, 30_000);

  afterAll(async () => {
    await admin.from("spots").delete().in("id", spotIds);
    await admin.from("blocks").delete().eq("blocker_id", userA.id);
    const ids = [userA.id, userB.id, userOtherCity.id, userBlocked.id, userShadow.id];
    await admin.from("profiles").delete().in("id", ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("ranks users by current-month spot count, highest first", async () => {
    const { data, error } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    expect(error).toBeNull();
    const b = data!.find((r: any) => r.handle === userB.handle);
    const a = data!.find((r: any) => r.handle === userA.handle);
    expect(b).toBeDefined();
    expect(a).toBeDefined();
    expect(Number(b.spot_count)).toBe(2);
    expect(Number(a.spot_count)).toBe(1);
    expect(data!.indexOf(b)).toBeLessThan(data!.indexOf(a));
  });

  it("does not count a spot from last month", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const b = data!.find((r: any) => r.handle === userB.handle);
    expect(Number(b.spot_count)).toBe(2); // still 2, not 3
  });

  it("does not count a hidden (non-live) spot", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const b = data!.find((r: any) => r.handle === userB.handle);
    expect(Number(b.spot_count)).toBe(2); // still 2, not 3
  });

  it("excludes a user from a different city entirely", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const other = data!.find((r: any) => r.handle === userOtherCity.handle);
    expect(other).toBeUndefined();
  });

  it("excludes a blocked user from the leaderboard", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const blocked = data!.find((r: any) => r.handle === userBlocked.handle);
    expect(blocked).toBeUndefined();
  });

  it("excludes a shadow-banned user from the leaderboard", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const shadow = data!.find((r: any) => r.handle === userShadow.handle);
    expect(shadow).toBeUndefined();
  });

  it("only exposes town-safe fields, never other private_info columns", async () => {
    const { data } = await clientA.rpc("get_city_leaderboard", { target_city: "LeaderTown" });
    const row = data![0];
    const keys = Object.keys(row);
    expect(keys).not.toContain("date_of_birth");
    expect(keys).not.toContain("state");
    expect(keys).not.toContain("country");
  });
});
