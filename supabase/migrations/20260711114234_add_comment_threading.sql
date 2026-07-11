-- One level of comment threading: top-level comments can have flat
-- replies (replying to a reply still attaches to the same top-level
-- parent, not deeper nesting — same pattern WhatsApp/Instagram use).

ALTER TABLE "public"."comments" ADD COLUMN IF NOT EXISTS "parent_comment_id" uuid
  REFERENCES "public"."comments"("id") ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION "public"."validate_comment_parent"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_spot uuid;
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT spot_id INTO parent_spot FROM public.comments WHERE id = NEW.parent_comment_id;
    IF parent_spot IS DISTINCT FROM NEW.spot_id THEN
      RAISE EXCEPTION 'A reply must belong to the same spot as its parent comment';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_comment_parent"
  BEFORE INSERT ON "public"."comments"
  FOR EACH ROW EXECUTE FUNCTION "public"."validate_comment_parent"();

CREATE OR REPLACE FUNCTION "public"."notify_on_comment"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE spot_owner uuid;
DECLARE parent_author uuid;
BEGIN
  SELECT user_id INTO spot_owner FROM public.spots WHERE id = NEW.spot_id;
  IF spot_owner IS NOT NULL AND spot_owner <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, spot_id, comment_text)
      VALUES (spot_owner, NEW.user_id, 'comment', NEW.spot_id, NEW.text);
  END IF;

  IF NEW.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.comments WHERE id = NEW.parent_comment_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id AND parent_author IS DISTINCT FROM spot_owner THEN
      INSERT INTO public.notifications (user_id, actor_id, type, spot_id, comment_text)
        VALUES (parent_author, NEW.user_id, 'comment', NEW.spot_id, NEW.text);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
