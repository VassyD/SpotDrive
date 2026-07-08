-- Supports multiple photos (max 4) and one optional video per spot.
-- spots.image_url is kept as-is (the "cover" photo, used by existing feed
-- card thumbnails) — spot_media is the new source of truth for the full
-- gallery, and existing spots are backfilled into it below.

CREATE TABLE IF NOT EXISTS "public"."spot_media" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "spot_id" uuid NOT NULL REFERENCES "public"."spots"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "media_url" text NOT NULL,
  "media_type" text NOT NULL CHECK (media_type IN ('image', 'video')),
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."spot_media" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spot media viewable by everyone" ON "public"."spot_media"
  FOR SELECT USING (true);

CREATE POLICY "Users insert own spot media" ON "public"."spot_media"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.spots WHERE id = spot_id AND user_id = auth.uid())
  );

CREATE POLICY "Users delete own spot media" ON "public"."spot_media"
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any spot media" ON "public"."spot_media"
  FOR DELETE USING (is_admin_user(auth.uid()));

CREATE POLICY "Block banned or suspended users from adding spot media" ON "public"."spot_media"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE OR REPLACE FUNCTION "public"."enforce_spot_media_limits"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  image_count integer;
  video_count integer;
BEGIN
  IF NEW.media_type = 'image' THEN
    SELECT count(*) INTO image_count FROM public.spot_media
      WHERE spot_id = NEW.spot_id AND media_type = 'image';
    IF image_count >= 4 THEN
      RAISE EXCEPTION 'A spot can have at most 4 photos';
    END IF;
  ELSIF NEW.media_type = 'video' THEN
    SELECT count(*) INTO video_count FROM public.spot_media
      WHERE spot_id = NEW.spot_id AND media_type = 'video';
    IF video_count >= 1 THEN
      RAISE EXCEPTION 'A spot can have at most 1 video';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_enforce_spot_media_limits"
  BEFORE INSERT ON "public"."spot_media"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_spot_media_limits"();

-- Backfill: every existing spot's single image_url becomes its first
-- gallery photo, so the new gallery UI works uniformly for old and new spots.
INSERT INTO public.spot_media (spot_id, user_id, media_url, media_type, position)
SELECT id, user_id, image_url, 'image', 0
FROM public.spots
WHERE image_url IS NOT NULL;