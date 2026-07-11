// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Comment editing
 *
 * Run with:
 *   npx vitest run tests/integration/comment-editing-live.test.ts
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
  const email = `cedit-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle: `cedit_${label}_${Date.now()}`, display_name: label },
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
let commentId: string;

beforeAll(async () => {
  owner = await createTestUser("owner");
  other = await createTestUser("other");
  ownerClient = await signInAs(owner.email);
  otherClient = await signInAs(other.email);

  const { data: spot } = await admin.from("spots")
    .insert({ user_id: owner.id, make: "Test", model: "CommentEditTest", status: "live" })
    .select().single();
  spotId = spot!.id;

  const { data: comment } = await ownerClient.from("comments")
    .insert({ spot_id: spotId, user_id: owner.id, text: "original text" })
    .select().single();
  commentId = comment!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("comments").delete().eq("id", commentId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [owner.id, other.id]);
  await admin.auth.admin.deleteUser(owner.id);
  await admin.auth.admin.deleteUser(other.id);
});

describe("LIVE: comment editing", () => {
  it("starts with no edited_at", async () => {
    const { data } = await admin.from("comments").select("edited_at").eq("id", commentId).single();
    expect(data?.edited_at).toBeNull();
  });

  it("prevents a different user from editing someone else's comment", async () => {
    const { data, error } = await otherClient.from("comments")
      .update({ text: "hijacked!" }).eq("id", commentId).select();
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBe(0); // RLS silently blocks, no rows affected
  });

  it("allows the owner to edit their own comment text", async () => {
    const { error } = await ownerClient.from("comments")
      .update({ text: "edited text" }).eq("id", commentId);
    expect(error).toBeNull();
    const { data } = await admin.from("comments").select("text").eq("id", commentId).single();
    expect(data?.text).toBe("edited text");
  });

  it("auto-sets edited_at when the text actually changes", async () => {
    const { data } = await admin.from("comments").select("edited_at").eq("id", commentId).single();
    expect(data?.edited_at).not.toBeNull();
  });

  it("does NOT update edited_at again if the update doesn't change the text", async () => {
    const { data: before } = await admin.from("comments").select("edited_at").eq("id", commentId).single();
    // Update likes_count only, text stays identical
    await admin.from("comments").update({ likes_count: 5 }).eq("id", commentId);
    const { data: after } = await admin.from("comments").select("edited_at").eq("id", commentId).single();
    expect(after?.edited_at).toBe(before?.edited_at);
  });
});