// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: @mentions in comments and spot descriptions
 *
 * Run with:
 *   npx vitest run tests/integration/mentions-live.test.ts
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
  const handle = `mention_${label}_${Date.now()}`;
  const email = `mention-${label}-${Date.now()}@example.com`;
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

let author: { id: string; email: string; handle: string };
let mentioned: { id: string; email: string; handle: string };
let blocked: { id: string; email: string; handle: string };
let clientAuthor: ReturnType<typeof createClient>;
let spotId: string;

beforeAll(async () => {
  author = await createTestUser("author");
  mentioned = await createTestUser("mentioned");
  blocked = await createTestUser("blocked");
  clientAuthor = await signInAs(author.email);

  await admin.from("blocks").insert({ blocker_id: author.id, blocked_id: blocked.id });

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: author.id, make: "Test", model: "Mentions", status: "live" })
    .select().single();
  spotId = spot!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("notifications").delete().eq("actor_id", author.id);
  await admin.from("comments").delete().eq("spot_id", spotId);
  await admin.from("blocks").delete().eq("blocker_id", author.id);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [author.id, mentioned.id, blocked.id]);
  await admin.auth.admin.deleteUser(author.id);
  await admin.auth.admin.deleteUser(mentioned.id);
  await admin.auth.admin.deleteUser(blocked.id);
});

describe("LIVE: mentions in comments", () => {
  it("notifies a real mentioned user", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `Hey @${mentioned.handle} check this out` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", mentioned.id).eq("type", "mention");
    expect(notifs?.length ?? 0).toBe(1);
    expect(notifs![0].actor_id).toBe(author.id);
    expect(notifs![0].spot_id).toBe(spotId);

    await admin.from("comments").delete().eq("id", comment!.id);
    await admin.from("notifications").delete().eq("id", notifs![0].id);
  });

  it("does not notify when mentioning yourself", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `@${author.handle} note to self` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("actor_id", author.id).eq("type", "mention").eq("user_id", author.id);
    expect(notifs?.length ?? 0).toBe(0);

    await admin.from("comments").delete().eq("id", comment!.id);
  });

  it("does not notify or error for a nonexistent handle", async () => {
    const { error } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: "@this_handle_does_not_exist_xyz hello" });
    expect(error).toBeNull();
  });

  it("does not notify a blocked user", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `@${blocked.handle} hi` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", blocked.id).eq("type", "mention");
    expect(notifs?.length ?? 0).toBe(0);

    await admin.from("comments").delete().eq("id", comment!.id);
  });

  it("only notifies for a newly-added mention on edit, not a pre-existing one", async () => {
    const { data: comment } = await clientAuthor.from("comments")
      .insert({ spot_id: spotId, user_id: author.id, text: `@${mentioned.handle} first` })
      .select().single();

    await admin.from("notifications").delete().eq("user_id", mentioned.id).eq("type", "mention");

    await clientAuthor.from("comments")
      .update({ text: `@${mentioned.handle} first, also cc @${author.handle}` })
      .eq("id", comment!.id);

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", mentioned.id).eq("type", "mention");
    expect(notifs?.length ?? 0).toBe(0);

    await admin.from("comments").delete().eq("id", comment!.id);
  });
});

describe("LIVE: mentions in spot descriptions", () => {
  it("notifies a real mentioned user when posting a spot with a mention", async () => {
    const { data: spot } = await admin.from("spots")
      .insert({ user_id: author.id, make: "Test", model: "DescMention", status: "live", description: `Spotted with @${mentioned.handle}` })
      .select().single();

    const { data: notifs } = await admin.from("notifications")
      .select("*").eq("user_id", mentioned.id).eq("type", "mention").eq("spot_id", spot!.id);
    expect(notifs?.length ?? 0).toBe(1);

    await admin.from("notifications").delete().eq("id", notifs![0].id);
    await admin.from("spots").delete().eq("id", spot!.id);
  });
});
