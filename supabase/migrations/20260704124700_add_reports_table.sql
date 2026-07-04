-- Reports table: stores individual report reasons, one per user per spot
CREATE TABLE IF NOT EXISTS "public"."reports" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "spot_id" uuid NOT NULL REFERENCES "public"."spots"("id") ON DELETE CASCADE,
  "reporter_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("spot_id", "reporter_id")  -- one report per user per spot
);

ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;

-- Users can report as themselves only
CREATE POLICY "Users can report as themselves" ON "public"."reports"
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Deliberately no SELECT/UPDATE/DELETE policy for regular users:
-- report review happens via Supabase Dashboard / service role, which
-- bypasses RLS entirely. Regular users (including the reporter) cannot
-- read report contents back through the client.

-- Atomically recompute report_count from the real reports table, and
-- auto-hide the spot once it reaches 5 reports. Runs as SECURITY DEFINER
-- since the reporting user does not own the spot and wouldn't otherwise
-- have UPDATE rights on it.
CREATE OR REPLACE FUNCTION "public"."update_spot_report_count"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
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

DROP TRIGGER IF EXISTS "trg_update_spot_report_count" ON "public"."reports";
CREATE TRIGGER "trg_update_spot_report_count"
  AFTER INSERT ON "public"."reports"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."update_spot_report_count"();