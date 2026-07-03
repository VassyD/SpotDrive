// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Storage RLS Integration Tests
 *
 * Tests the actual storage.objects RLS policies on the `spot-photos` bucket
 * against a real local Supabase stack (Postgres + Storage API), not mocks.
 *
 * Prerequisites:
 *   1. Docker Desktop running
 *   2. `supabase start` running in this project
 *
 * Run with:
 *   npx vitest run tests/integration/storage-rls-live.test.ts
 *
 * Policies under test (from supabase/migrations/storage_policies_reference.sql):
 *   - "Anyone can view photos": SELECT allowed for anyone, bucket = spot-photos
 *   - "Auth users can upload": INSERT requires authenticated role AND folder
 *     must be one of spots/avatars/stories
 *   - "Users delete own files": DELETE requires auth.uid() to match the
 *     2nd path segment, e.g. spots/{userId}/photo.jpg
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY || !SERVICE_KEY) {
  throw new Error(
    "Missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY env vars.\n" +
    "Run `supabase status -o env` to get local values."
  );
}

const BUCKET = "spot-photos";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "test-password-123";
let userA: { id: string; email: string };
let userB: { id: string; email: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let anonClient: ReturnType<typeof createClient>;

async function createTestUser(label: string) {
  const email = `storage-rls-${label}-${Date.now()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
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

const testFile = () => new Blob(["test file content"], { type: "image/jpeg" });

beforeAll(async () => {
  // Ensure the bucket exists locally (idempotent — ignore "already exists")
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});

  userA = await createTestUser("a");
  userB = await createTestUser("b");
  clientA = await signInAs(userA.email);
  clientB = await signInAs(userB.email);
  anonClient = createClient(SUPABASE_URL, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}, 30_000);

afterAll(async () => {
  // Clean up any files we created
  await admin.storage.from(BUCKET).remove([
    `spots/${userA.id}/photo.jpg`,
    `spots/${userB.id}/photo.jpg`,
    `malicious/${userA.id}/photo.jpg`,
  ]);
  if (userA?.id) await admin.auth.admin.deleteUser(userA.id);
  if (userB?.id) await admin.auth.admin.deleteUser(userB.id);
});

describe("LIVE RLS: storage.objects (spot-photos bucket)", () => {
  it("allows an authenticated user to upload to a valid folder", async () => {
    const { error } = await clientA.storage
      .from(BUCKET)
      .upload(`spots/${userA.id}/photo.jpg`, testFile(), { upsert: true });
    expect(error).toBeNull();
  });

  it("prevents an unauthenticated (anon) user from uploading", async () => {
    const { error } = await anonClient.storage
      .from(BUCKET)
      .upload(`spots/anon-test/photo.jpg`, testFile(), { upsert: true });
    expect(error).not.toBeNull();
  });

  it("prevents uploading to a folder outside spots/avatars/stories", async () => {
    const { error } = await clientA.storage
      .from(BUCKET)
      .upload(`malicious/${userA.id}/photo.jpg`, testFile(), { upsert: true });
    expect(error).not.toBeNull();
  });

  it("allows anyone (including anon) to read/view uploaded photos", async () => {
    const { data, error } = await anonClient.storage
      .from(BUCKET)
      .download(`spots/${userA.id}/photo.jpg`);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });

  it("allows the owner to delete their own file", async () => {
    // Upload a fresh one to delete, so we don't depend on test ordering
    await clientA.storage
      .from(BUCKET)
      .upload(`spots/${userA.id}/to-delete.jpg`, testFile(), { upsert: true });

    const { error } = await clientA.storage
      .from(BUCKET)
      .remove([`spots/${userA.id}/to-delete.jpg`]);
    expect(error).toBeNull();
  });

  it("prevents a different user from deleting someone else's file", async () => {
    // Ensure the file exists (owned by userA)
    await clientA.storage
      .from(BUCKET)
      .upload(`spots/${userA.id}/photo.jpg`, testFile(), { upsert: true });

    const { data, error } = await clientB.storage
      .from(BUCKET)
      .remove([`spots/${userA.id}/photo.jpg`]);

    // Supabase Storage often returns success with an empty result rather than
    // an explicit error when RLS blocks a delete — check both possibilities.
    const blocked = error !== null || (data?.length ?? 0) === 0;
    expect(blocked).toBe(true);

    // Confirm the file is genuinely still there via admin (bypasses RLS)
    const { data: stillThere } = await admin.storage
      .from(BUCKET)
      .list(`spots/${userA.id}`);
    expect(stillThere?.some((f) => f.name === "photo.jpg")).toBe(true);
  });
});
