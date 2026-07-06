-- Real, persisted likes and saves — previously these only existed as
-- client-side local state (never written to the database), and spots'
-- likes_count/saves_count/comments_count were seeded with fake numbers
-- with no real data backing them (visible as the mismatch between the
-- feed card's stale count and the comments sheet's real count of 0).

CREATE TABLE IF NOT EXISTS "public"."likes" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "spot_id" uuid NOT NULL REFERENCES "public"."spots"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("spot_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "public"."saves" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "spot_id" uuid NOT NULL REFERENCES "public"."spots"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("spot_id", "user_id")
);

ALTER TABLE "public"."likes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."saves" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own likes" ON "public"."likes"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own saves" ON "public"."saves"
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Block banned or suspended users from liking" ON "public"."likes"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));
CREATE POLICY "Block banned or suspended users from saving" ON "public"."saves"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE OR REPLACE FUNCTION "public"."update_spot_likes_count"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected_spot uuid;
BEGIN
  affected_spot := COALESCE(NEW.spot_id, OLD.spot_id);
  UPDATE public.spots SET likes_count = (
    SELECT count(*) FROM public.likes WHERE spot_id = affected_spot
  ) WHERE id = affected_spot;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION "public"."update_spot_saves_count"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected_spot uuid;
BEGIN
  affected_spot := COALESCE(NEW.spot_id, OLD.spot_id);
  UPDATE public.spots SET saves_count = (
    SELECT count(*) FROM public.saves WHERE spot_id = affected_spot
  ) WHERE id = affected_spot;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER "trg_update_spot_likes_count"
  AFTER INSERT OR DELETE ON "public"."likes"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_spot_likes_count"();

CREATE TRIGGER "trg_update_spot_saves_count"
  AFTER INSERT OR DELETE ON "public"."saves"
  FOR EACH ROW EXECUTE FUNCTION "public"."update_spot_saves_count"();

UPDATE "public"."spots" SET
  likes_count = 0,
  saves_count = 0,
  comments_count = (SELECT count(*) FROM public.comments WHERE spot_id = spots.id);