// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

/**
 * LIVE Integration Tests: Content Moderation / Reports
 *
 * Tests the real `reports` table, its RLS policies, and the
 * `update_spot_report_count` trigger against a real local Postgres
 * instance via `supabase start` — not mocks.
 *
 * Run with:
 *   npx vitest run tests/integration/reports-live.test.ts
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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = "test-password-123";
let reporterA: { id: string; email: string };
let reporterB: { id: string; email: string };
let spotOwner: { id: string; email: string };
let clientA: ReturnType<typeof createClient>;
let clientB: ReturnType<typeof createClient>;
let spotId: string;

async function createTestUser(label: string) {
  const email = `reports-${label}-${Date.now()}@example.com`;
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

beforeAll(async () => {
  spotOwner = await createTestUser("owner");
  reporterA = await createTestUser("a");
  reporterB = await createTestUser("b");
  clientA = await signInAs(reporterA.email);
  clientB = await signInAs(reporterB.email);

  await admin.from("profiles").insert([
    { id: spotOwner.id, handle: `rpt_owner_${Date.now()}`, display_name: "Owner" },
    { id: reporterA.id, handle: `rpt_a_${Date.now()}`, display_name: "Reporter A" },
    { id: reporterB.id, handle: `rpt_b_${Date.now()}`, display_name: "Reporter B" },
  ]);

  const { data: spot, error } = await admin
    .from("spots")
    .insert({ user_id: spotOwner.id, make: "Test", model: "ReportTarget", status: "live" })
    .select()
    .single();
  if (error || !spot) throw new Error(`Failed to create test spot: ${error?.message}`);
  spotId = spot.id;
}, 30_000);

afterAll(async () => {
  await admin.from("reports").delete().eq("spot_id", spotId);
  await admin.from("spots").delete().eq("id", spotId);
  await admin.from("profiles").delete().in("id", [spotOwner.id, reporterA.id, reporterB.id]);
  await admin.auth.admin.deleteUser(spotOwner.id);
  await admin.auth.admin.deleteUser(reporterA.id);
  await admin.auth.admin.deleteUser(reporterB.id);
});

describe("LIVE: reports table", () => {
  it("allows an authenticated user to report a spot as themselves", async () => {
    const { error } = await clientA
      .from("reports")
      .insert({ spot_id: spotId, reporter_id: reporterA.id, reason: "Spam" });
    expect(error).toBeNull();
  });

  it("prevents a user from submitting a report as someone else", async () => {
    const { error } = await clientB
      .from("reports")
      .insert({ spot_id: spotId, reporter_id: reporterA.id, reason: "Fake report" });
    expect(error).not.toBeNull();
  });

  it("prevents the same user from reporting the same spot twice (dedup)", async () => {
    const { error } = await clientA
      .from("reports")
      .insert({ spot_id: spotId, reporter_id: reporterA.id, reason: "Trying again" });
    expect(error).not.toBeNull(); // unique constraint violation
  });

  it("allows a user to see only their own submitted reports, not others'", async () => {
    const { data: ownData, error: ownError } = await clientA.from("reports").select("*").eq("spot_id", spotId);
    expect(ownError).toBeNull();
    expect(ownData?.length ?? 0).toBe(1);
    expect(ownData?.[0].reporter_id).toBe(reporterA.id);

    // reporterB hasn't reported this spot, so they should see nothing for it
    const { data: otherData, error: otherError } = await clientB.from("reports").select("*").eq("spot_id", spotId);
    expect(otherError).toBeNull();
    expect(otherData?.length ?? 0).toBe(0);
  });

  it("atomically recomputes report_count via trigger, and auto-hides at 5 reports", async () => {
    // reporterA already reported above (count should be 1). Add 4 more
    // distinct reporters to cross the auto-hide threshold.
    const extraReporters = await Promise.all(
      ["c", "d", "e", "f"].map((label) => createTestUser(label))
    );
    await admin.from("profiles").insert(
      extraReporters.map((u, i) => ({
        id: u.id,
        handle: `rpt_extra_${i}_${Date.now()}`,
        display_name: `Extra ${i}`,
      }))
    );

    for (const reporter of extraReporters) {
      const client = await signInAs(reporter.email);
      const { error } = await client
        .from("reports")
        .insert({ spot_id: spotId, reporter_id: reporter.id, reason: "Pile-on report" });
      expect(error).toBeNull();
    }

    // Total distinct reporters: reporterA + 4 extras = 5 → should trigger auto-hide
    const { data: spot } = await admin
      .from("spots")
      .select("report_count, status")
      .eq("id", spotId)
      .single();

    expect(spot?.report_count).toBe(5);
    expect(spot?.status).toBe("hidden");

    // Cleanup extra reporters
    await admin.from("profiles").delete().in("id", extraReporters.map((u) => u.id));
    for (const u of extraReporters) await admin.auth.admin.deleteUser(u.id);
  }, 20_000);
});
