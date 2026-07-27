// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Direct Messages
 * (conversations, messages, read receipts, notifications, blocking, storage)
 *
 * Run with:
 *   npx vitest run tests/integration/direct-messages-live.test.ts
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
  const handle = `dm_${label}_${Date.now()}`;
  const email = `dm-${label}-${Date.now()}@example.com`;
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

function orderedPair(idA: string, idB: string) {
  return idA < idB ? [idA, idB] : [idB, idA];
}

let userA: { id: string; email: string; handle: string };
let userB: { id: string; email: string; handle: string };
let userC: { id: string; email: string; handle: string };
let userD: { id: string; email: string; handle: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let clientC: ReturnType<typeof createClient>;
let clientD: ReturnType<typeof createClient>;
let conversationId: string;

beforeAll(async () => {
  userA = await createTestUser("a");
  userB = await createTestUser("b");
  userC = await createTestUser("c");
  userD = await createTestUser("d");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  clientC = await signInAs(userC.email);
  clientD = await signInAs(userD.email);

  await admin.from("blocks").insert({ blocker_id: userA.id, blocked_id: userD.id });

  const [a, b] = orderedPair(userA.id, userB.id);
  const { data } = await admin.from("conversations")
    .insert({ user_a_id: a, user_b_id: b })
    .select().single();
  conversationId = data!.id;
}, 20_000);

afterAll(async () => {
  await admin.from("notifications").delete().in("actor_id", [userA.id, userB.id]);
  await admin.from("messages").delete().eq("conversation_id", conversationId);
  await admin.from("conversations").delete().eq("id", conversationId);
  await admin.from("blocks").delete().eq("blocker_id", userA.id);
  await admin.from("profiles").delete().in("id", [userA.id, userB.id, userC.id, userD.id]);
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);
  await admin.auth.admin.deleteUser(userC.id);
  await admin.auth.admin.deleteUser(userD.id);
});

describe("LIVE: conversations - creation and constraints", () => {
  it("rejects a self-conversation", async () => {
    const { error } = await admin.from("conversations")
      .insert({ user_a_id: userC.id, user_b_id: userC.id });
    expect(error).not.toBeNull();
  });

  it("rejects a duplicate conversation between the same pair", async () => {
    const [a, b] = orderedPair(userA.id, userB.id);
    const { error } = await admin.from("conversations").insert({ user_a_id: a, user_b_id: b });
    expect(error).not.toBeNull();
  });

  it("rejects an insert with the pair in the wrong order", async () => {
    const [a, b] = orderedPair(userA.id, userC.id);
    const { error } = await admin.from("conversations")
      .insert({ user_a_id: b, user_b_id: a }); // deliberately swapped
    expect(error).not.toBeNull();
  });
});

describe("LIVE: conversations - visibility", () => {
  it("both participants can see the conversation", async () => {
    const { data: seesA } = await clientA.from("conversations").select("id").eq("id", conversationId);
    const { data: seesB } = await clientB.from("conversations").select("id").eq("id", conversationId);
    expect(seesA?.length ?? 0).toBe(1);
    expect(seesB?.length ?? 0).toBe(1);
  });

  it("an uninvolved third party cannot see it", async () => {
    const { data } = await clientC.from("conversations").select("id").eq("id", conversationId);
    expect(data?.length ?? 0).toBe(0);
  });
});

describe("LIVE: messages - sending and viewing", () => {
  let messageId: string;

  it("a participant can send a text message", async () => {
    const { data, error } = await clientA.from("messages")
      .insert({ conversation_id: conversationId, sender_id: userA.id, text: "Hey, nice spot!" })
      .select().single();
    expect(error).toBeNull();
    messageId = data!.id;
  });

  it("rejects a message with neither text nor photo", async () => {
    const { error } = await clientA.from("messages")
      .insert({ conversation_id: conversationId, sender_id: userA.id });
    expect(error).not.toBeNull();
  });

  it("both participants can view the message", async () => {
    const { data: seesA } = await clientA.from("messages").select("id").eq("id", messageId);
    const { data: seesB } = await clientB.from("messages").select("id").eq("id", messageId);
    expect(seesA?.length ?? 0).toBe(1);
    expect(seesB?.length ?? 0).toBe(1);
  });

  it("a non-participant cannot send a message into someone else's conversation", async () => {
    const { error } = await clientC.from("messages")
      .insert({ conversation_id: conversationId, sender_id: userC.id, text: "butting in" });
    expect(error).not.toBeNull();
  });

  it("creates a real notification for the recipient", async () => {
    const { data } = await admin.from("notifications")
      .select("*").eq("user_id", userB.id).eq("type", "message").eq("actor_id", userA.id);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: read receipts", () => {
  let messageId: string;

  beforeAll(async () => {
    const { data } = await admin.from("messages")
      .insert({ conversation_id: conversationId, sender_id: userA.id, text: "read receipt test" })
      .select().single();
    messageId = data!.id;
  });

  it("the sender cannot mark their own message as read", async () => {
    const { error } = await clientA.from("messages")
      .update({ read_at: new Date().toISOString() }).eq("id", messageId);
    const { data } = await admin.from("messages").select("read_at").eq("id", messageId).single();
    expect(data!.read_at).toBeNull();
  });

  it("the recipient can mark the message as read", async () => {
    const { error } = await clientB.from("messages")
      .update({ read_at: new Date().toISOString() }).eq("id", messageId);
    expect(error).toBeNull();
    const { data } = await admin.from("messages").select("read_at").eq("id", messageId).single();
    expect(data!.read_at).not.toBeNull();
  });
});

describe("LIVE: blocking", () => {
  it("blocked users cannot create a new conversation with each other", async () => {
    const [a, b] = orderedPair(userA.id, userD.id);
    const { error } = await clientA.from("conversations").insert({ user_a_id: a, user_b_id: b });
    expect(error).not.toBeNull();
  });

  it("an existing conversation becomes invisible to both parties once blocked", async () => {
    const eF = await createTestUser("e");
    const fF = await createTestUser("f");
    const clientE = await signInAs(eF.email);
    const clientF = await signInAs(fF.email);
    const [a, b] = orderedPair(eF.id, fF.id);
    const { data: conv } = await admin.from("conversations").insert({ user_a_id: a, user_b_id: b }).select().single();

    const { data: beforeE } = await clientE.from("conversations").select("id").eq("id", conv!.id);
    expect(beforeE?.length ?? 0).toBe(1);

    await admin.from("blocks").insert({ blocker_id: eF.id, blocked_id: fF.id });
    const { data: afterE } = await clientE.from("conversations").select("id").eq("id", conv!.id);
    const { data: afterF } = await clientF.from("conversations").select("id").eq("id", conv!.id);
    expect(afterE?.length ?? 0).toBe(0);
    expect(afterF?.length ?? 0).toBe(0);

    await admin.from("blocks").delete().eq("blocker_id", eF.id);
    await admin.from("conversations").delete().eq("id", conv!.id);
    await admin.from("profiles").delete().in("id", [eF.id, fF.id]);
    await admin.auth.admin.deleteUser(eF.id);
    await admin.auth.admin.deleteUser(fF.id);
  });
});

describe("LIVE: storage - message photo attachments", () => {
  it("allows uploading into your own messages folder", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientA.storage
      .from("spot-photos")
      .upload(`messages/${userA.id}/test.jpg`, file, { upsert: true });
    expect(error).toBeNull();
  });

  it("blocks uploading into someone else's messages folder", async () => {
    const file = new Blob(["test"], { type: "image/jpeg" });
    const { error } = await clientC.storage
      .from("spot-photos")
      .upload(`messages/${userA.id}/attack.jpg`, file, { upsert: true });
    expect(error).not.toBeNull();
  });
});
