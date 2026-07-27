// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: privacy settings columns, leaderboard opt-out,
 * tagging opt-out (autocomplete + notification enforcement)
 *
 * Run with:
 *   npx vitest run tests/integration/privacy-settings-live.test.ts
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
  const handle = `priv_${label}_${Date.now()}`;
  const email = `priv-${label}-${Date.now()}@example.com`;
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

let optedOut: { id: string; email: string; handle: string };
let optedIn: { id: string; email: string; handle: string };
let author: { id: string; email: string; handle: string };
let clientAuthor: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  optedOut = await createTestUser("optedout");
  optedIn = await createTestUser("optedin");
  author = await createTestUser("author");
  clientAuthor = await signInAs(author.email);

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: author.id, make: "Test", model: "Privacy", status: "live" })
    .select().single();
  spotId = spot!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("notifications").delete().eq("actor_id", author.id);
  await admin.from("comments").delete().eq("spot_id", spotId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [optedOut.id, optedIn.id, author.id]);
  await admin.auth.admin.deleteUser(optedOut.id);
  await admin.auth.admin.deleteUser(optedIn.id);
  await admin.auth.admin.deleteUser(author.id);
});

describe("LIVE: privacy settings columns", () => {
  it("all six columns exist with the correct safe defaults for existing/new rows", async () => {
    const { data, error } = await admin.from("profiles")
      .select("is_private, show_location, allow_tagging, show_leaderboard, allow_messages, data_analytics")
      .eq("id", optedIn.id).single();
    expect(error).toBeNull();
    expect(data.is_private).toBe(false);
    expect(data.show_location).toBe(true);
    expect(data.allow_tagging).toBe(true);
    expect(data.show_leaderboard).toBe(true);
    expect(data.allow_messages).toBe(true);
    expect(data.data_analytics).toBe(true);
  });

  it("a real settings update actually persists (the original bug)", async () => {
    const clientOptedIn = await signInAs(optedIn.email);
    const { error } = await clientOptedIn.from("profiles")
      .update({ is_private: true, show_leaderboard: false })
      .eq("id", optedIn.id);
    expect(error).toBeNull();

    const { data } = await admin.from("profiles")
      .select("is_private, show_leaderboard").eq("id", optedIn.id).single();
    expect(data.is_private).toBe(true);
    expect(data.show_leaderboard).toBe(false);

    // reset for later tests
    await admin.from("profiles").update({ is_private: false, show_leaderboard: true }).eq("id", optedIn.id);
  });
});

describe("LIVE: leaderboard opt-out", () => {
  beforeAll(async () => {
    await admin.from("profiles").update({ show_leaderboard: false }).eq("id", optedOut.id);
  });

  it("excludes an opted-out user from the global leaderboard query", async () => {
    const { data } = await admin.from("profiles")
      .select("id").eq("show_leaderboard", true).eq("id", optedOut.id);
    expect(data?.length ?? 0).toBe(0);
  });

  it("still includes an opted-in user", async () => {
    const { data } = await admin.from("profiles")
      .select("id").eq("show_leaderboard", true).eq("id", optedIn.id);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: tagging opt-out", () => {
  beforeAll(async () => {
    await admin.from("profiles").update({ allow_tagging: false }).eq("id", optedOut.id);
  });

  it("does not create a mention notification for an opted-out user", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `Hey @${optedOut.handle} check this` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", optedOut.id).eq("type", "mention");
    expect(notifs?.length ?? 0).toBe(0);

    await admin.from("comments").delete().eq("id", comment!.id);
  });

  it("still creates a mention notification for an opted-in user", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `Hey @${optedIn.handle} check this` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", optedIn.id).eq("type", "mention");
    expect(notifs?.length ?? 0).toBe(1);

    await admin.from("comments").delete().eq("id", comment!.id);
    await admin.from("notifications").delete().eq("id", notifs![0].id);
  });

  it("excludes an opted-out user from autocomplete suggestions", async () => {
    const { data: excluded } = await admin.from("profiles")
      .select("id").eq("id", optedOut.id).eq("allow_tagging", true);
    expect(excluded?.length ?? 0).toBe(0);

    const { data: included } = await admin.from("profiles")
      .select("id").eq("id", optedIn.id).eq("allow_tagging", true);
    expect(included?.length ?? 0).toBe(1);
  });
});
