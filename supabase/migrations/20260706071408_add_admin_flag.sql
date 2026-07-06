-- Adds a simple admin flag to profiles, extensible to more admins later.
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false;

-- Tracks whether a report has been reviewed by a moderator.
ALTER TABLE "public"."reports" ADD COLUMN IF NOT EXISTS "reviewed" boolean DEFAULT false;

-- Admins can view all reports (regular users still cannot, per the
-- original design -- this is a new, separate, additive policy).
CREATE POLICY "Admins can view all reports" ON "public"."reports"
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM "public"."profiles" WHERE "id" = auth.uid() AND "is_admin" = true)
  );

-- Admins can mark reports as reviewed.
CREATE POLICY "Admins can update reports" ON "public"."reports"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "public"."profiles" WHERE "id" = auth.uid() AND "is_admin" = true)
  );

-- Admins can update any spot (e.g. un-hide a spot that was auto-hidden
-- incorrectly). This is additive to the existing owner-only update policy.
CREATE POLICY "Admins can update any spot" ON "public"."spots"
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM "public"."profiles" WHERE "id" = auth.uid() AND "is_admin" = true)
  );