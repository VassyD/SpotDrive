-- Extends reports to cover comments and users, not just spots.
-- Exactly one target (spot_id, comment_id, reported_user_id) must be set.

ALTER TABLE "public"."reports" ALTER COLUMN "spot_id" DROP NOT NULL;
ALTER TABLE "public"."reports" ADD COLUMN IF NOT EXISTS "comment_id" uuid
  REFERENCES "public"."comments"("id") ON DELETE CASCADE;
ALTER TABLE "public"."reports" ADD COLUMN IF NOT EXISTS "reported_user_id" uuid
  REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_exactly_one_target" CHECK (
  ((spot_id IS NOT NULL)::int + (comment_id IS NOT NULL)::int + (reported_user_id IS NOT NULL)::int) = 1
);

-- Replace the old single UNIQUE(spot_id, reporter_id) with three partial
-- unique indexes, one per target type — NULLs don't collide in a plain
-- UNIQUE constraint, so dedup needs to be scoped per target explicitly.
ALTER TABLE "public"."reports" DROP CONSTRAINT IF EXISTS "reports_spot_id_reporter_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "reports_unique_spot"
  ON "public"."reports" ("spot_id", "reporter_id") WHERE "spot_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "reports_unique_comment"
  ON "public"."reports" ("comment_id", "reporter_id") WHERE "comment_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "reports_unique_user"
  ON "public"."reports" ("reported_user_id", "reporter_id") WHERE "reported_user_id" IS NOT NULL;

-- The auto-hide trigger only makes sense for spot reports — guard it so it
-- no-ops for comment/user reports instead of erroring on a NULL spot_id.
CREATE OR REPLACE FUNCTION "public"."update_spot_report_count"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  IF NEW.spot_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE "public"."spots"
  SET report_count = (
    SELECT count(*) FROM "public"."reports" WHERE spot_id = NEW.spot_id
  )
  WHERE id = NEW.spot_id
  RETURNING report_count INTO new_count;

  IF new_count >= 5 THEN
    UPDATE "public"."spots" SET status = 'hidden' WHERE id = NEW.spot_id;
  END IF;

  RETURN NEW;
END;
$$;