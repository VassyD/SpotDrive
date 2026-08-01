// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: signup analytics (events table + UTM attribution)
 *
 * Run with:
 *   npx vitest run tests/integration/signup-analytics-live.test.ts
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

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function createTestUser(label: string, metadata: Record<string, any> = {}) {
  const handle = `sa_${label}_${Date.now()}`;
  const email = `sa-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: { handle, display_name: label, ...metadata },
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

let regularUser: { id: string; email: string; handle: string };
let adminUser: { id: string; email: string; handle: string };
let attributedUser: { id: string; email: string; handle: string };
let noAttributionUser: { id: string; email: string; handle: string };
let clientRegular: ReturnType<typeof createClient>;
let clientAdmin: ReturnType<typeof createClient>;
let insertedEventId: string;

beforeAll(async () => {
  regularUser = await createTestUser("regular");
  adminUser = await createTestUser("admin");
  attributedUser = await createTestUser("attributed", {
    utm_source: "tiktok", utm_medium: "influencer", utm_campaign: "launch-week1",
  });
  noAttributionUser = await createTestUser("noattr");

  clientRegular = await signInAs(regularUser.email);
  clientAdmin = await signInAs(adminUser.email);
  await admin.from("profiles").update({ is_admin: true }).eq("id", adminUser.id);
}, 20_000);

afterAll(async () => {
  await admin.from("events").delete().eq("anon_id", "test-anon-id-12345");
  const ids = [regularUser.id, adminUser.id, attributedUser.id, noAttributionUser.id];
  await admin.from("profiles").delete().in("id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
});

describe("LIVE: events table RLS", () => {
  it("allows a fully anonymous client (no session) to log a signup_started event", async () => {
    // No .select() here - asking for the row back after insert is itself
    // a SELECT under the hood, which anon isn't allowed to do (RLS: only
    // admins can read events). The insert itself is what's under test.
    const client = anonClient();
    const { error } = await client.from("events").insert({
      event_type: "signup_started",
      anon_id: "test-anon-id-12345",
      utm_source: "reddit",
      utm_medium: "organic",
      utm_campaign: "launch",
    });
    expect(error).toBeNull();

    const { data } = await admin.from("events").select("id").eq("anon_id", "test-anon-id-12345").single();
    insertedEventId = data!.id;
  });

  it("rejects an invalid event_type", async () => {
    const client = anonClient();
    const { error } = await client.from("events").insert({
      event_type: "not_a_real_type",
      anon_id: "test-anon-id-99999",
    });
    expect(error).not.toBeNull();
  });

  it("a non-admin authenticated user cannot read events", async () => {
    const { data } = await clientRegular.from("events").select("id").eq("id", insertedEventId);
    expect(data?.length ?? 0).toBe(0);
  });

  it("an admin can read events", async () => {
    const { data } = await clientAdmin.from("events").select("id").eq("id", insertedEventId);
    expect(data?.length ?? 0).toBe(1);
  });
});

describe("LIVE: signup UTM attribution", () => {
  it("populates signup_utm_* columns when metadata is provided at signup", async () => {
    const { data } = await admin.from("profiles")
      .select("signup_utm_source, signup_utm_medium, signup_utm_campaign")
      .eq("id", attributedUser.id).single();
    expect(data!.signup_utm_source).toBe("tiktok");
    expect(data!.signup_utm_medium).toBe("influencer");
    expect(data!.signup_utm_campaign).toBe("launch-week1");
  });

  it("leaves signup_utm_* columns null when no metadata is provided (regression check)", async () => {
    const { data } = await admin.from("profiles")
      .select("signup_utm_source, signup_utm_medium, signup_utm_campaign")
      .eq("id", noAttributionUser.id).single();
    expect(data!.signup_utm_source).toBeNull();
    expect(data!.signup_utm_medium).toBeNull();
    expect(data!.signup_utm_campaign).toBeNull();
  });

  it("regular signup fields (handle, display_name) still populate correctly (regression check)", async () => {
    const { data } = await admin.from("profiles")
      .select("handle, display_name")
      .eq("id", regularUser.id).single();
    expect(data!.handle).toBe(regularUser.handle);
    expect(data!.display_name).toBe("regular");
  });
});
