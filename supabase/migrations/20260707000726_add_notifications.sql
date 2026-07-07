-- Real notifications system, replacing NotificationsScreen's hardcoded
-- mock data. Notifications are only ever created by SECURITY DEFINER
-- triggers (never directly by clients), one per like/save/comment/follow
-- event, skipping self-notifications (e.g. liking your own spot).

CREATE TABLE IF NOT EXISTS "public"."notifications" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "user_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "type" text NOT NULL CHECK (type IN ('like', 'save', 'comment', 'follow')),
  "spot_id" uuid REFERENCES "public"."spots"("id") ON DELETE CASCADE,
  "comment_text" text,
  "read" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON "public"."notifications"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON "public"."notifications"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION "public"."notify_on_like"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spot_owner uuid;
BEGIN
  SELECT user_id INTO spot_owner FROM public.spots WHERE id = NEW.spot_id;
  IF spot_owner IS NOT NULL AND spot_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, spot_id)
      VALUES (spot_owner, NEW.user_id, 'like', NEW.spot_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_save"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spot_owner uuid;
BEGIN
  SELECT user_id INTO spot_owner FROM public.spots WHERE id = NEW.spot_id;
  IF spot_owner IS NOT NULL AND spot_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, spot_id)
      VALUES (spot_owner, NEW.user_id, 'save', NEW.spot_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_comment"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spot_owner uuid;
BEGIN
  SELECT user_id INTO spot_owner FROM public.spots WHERE id = NEW.spot_id;
  IF spot_owner IS NOT NULL AND spot_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, spot_id, comment_text)
      VALUES (spot_owner, NEW.user_id, 'comment', NEW.spot_id, NEW.text);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."notify_on_follow"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_notify_on_like" AFTER INSERT ON "public"."likes"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_like"();
CREATE TRIGGER "trg_notify_on_save" AFTER INSERT ON "public"."saves"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_save"();
CREATE TRIGGER "trg_notify_on_comment" AFTER INSERT ON "public"."comments"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_comment"();
CREATE TRIGGER "trg_notify_on_follow" AFTER INSERT ON "public"."follows"
  FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_follow"();