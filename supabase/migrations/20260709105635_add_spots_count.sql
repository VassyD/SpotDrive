-- Real bug found: profiles.spots_count never existed anywhere in the
-- schema, despite being referenced throughout the app (own profile stats,
-- spotter profile sheets, leaderboard scoring). Every "Spots" count shown
-- anywhere has always silently defaulted to 0 via `||0` fallbacks,
-- regardless of how many spots a user actually posted.
--
-- Counts only 'live' spots (matching what's actually publicly visible),
-- and updates on insert, delete, AND status changes (a spot can move to
-- 'hidden' via the reports auto-hide trigger or an admin action, and back
-- to 'live' via un-hide — both should correctly adjust the count).

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "spots_count" integer DEFAULT 0 NOT NULL;

CREATE OR REPLACE FUNCTION "public"."update_profile_spots_count"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected_user uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_user := OLD.user_id;
  ELSE
    affected_user := NEW.user_id;
  END IF;

  UPDATE public.profiles SET spots_count = (
    SELECT count(*) FROM public.spots WHERE user_id = affected_user AND status = 'live'
  ) WHERE id = affected_user;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS "trg_update_profile_spots_count" ON "public"."spots";
CREATE TRIGGER "trg_update_profile_spots_count"
  AFTER INSERT OR DELETE OR UPDATE OF status ON "public"."spots"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_profile_spots_count"();

-- Backfill: recompute every existing profile's real live spot count.
UPDATE "public"."profiles" SET spots_count = (
  SELECT count(*) FROM "public"."spots" WHERE user_id = profiles.id AND status = 'live'
);