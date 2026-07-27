-- Mentions: parses @handle out of comments and spot descriptions,
-- notifies the mentioned user. Silently skips (no error, doesn't
-- block the save): mentioning yourself, a handle that doesn't exist,
-- or someone you're blocked with (either direction). On edits, only
-- newly-added mentions notify — not ones already present before the
-- edit, so an unrelated edit doesn't re-spam everyone already tagged.

CREATE OR REPLACE FUNCTION extract_mentioned_handles(input_text text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT lower(m[1])), ARRAY[]::text[])
  FROM regexp_matches(coalesce(input_text, ''), '@([a-zA-Z0-9_]+)', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION notify_on_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_handles text[];
  old_handles text[] := ARRAY[]::text[];
  added_handles text[];
  h text;
  mentioned_id uuid;
  actor uuid;
  target_spot_id uuid;
  full_text text;
BEGIN
  IF TG_TABLE_NAME = 'comments' THEN
    actor := NEW.user_id;
    target_spot_id := NEW.spot_id;
    full_text := NEW.text;
    new_handles := extract_mentioned_handles(NEW.text);
    IF TG_OP = 'UPDATE' THEN
      old_handles := extract_mentioned_handles(OLD.text);
    END IF;
  ELSIF TG_TABLE_NAME = 'spots' THEN
    actor := NEW.user_id;
    target_spot_id := NEW.id;
    full_text := NEW.description;
    new_handles := extract_mentioned_handles(NEW.description);
    IF TG_OP = 'UPDATE' THEN
      old_handles := extract_mentioned_handles(OLD.description);
    END IF;
  END IF;

  SELECT array_agg(x) INTO added_handles
  FROM unnest(new_handles) x
  WHERE x <> ALL(old_handles);

  IF added_handles IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH h IN ARRAY added_handles LOOP
    SELECT id INTO mentioned_id FROM profiles WHERE lower(handle) = h;

    IF mentioned_id IS NOT NULL
       AND mentioned_id <> actor
       AND NOT is_blocked_either_way(mentioned_id) THEN
      INSERT INTO notifications (user_id, actor_id, type, spot_id, comment_text, read)
      VALUES (mentioned_id, actor, 'mention', target_spot_id, full_text, false);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_comment_mention
AFTER INSERT OR UPDATE OF text ON comments
FOR EACH ROW EXECUTE FUNCTION notify_on_mention();

CREATE TRIGGER trg_notify_on_spot_mention
AFTER INSERT OR UPDATE OF description ON spots
FOR EACH ROW EXECUTE FUNCTION notify_on_mention();
-- 'mention' was never added to this constraint, despite already being
-- fully wired into the frontend's notification-type display config.
ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['like'::text, 'save'::text, 'comment'::text, 'follow'::text, 'mention'::text]));
