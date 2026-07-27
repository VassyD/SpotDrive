-- The entire Privacy/Notifications settings screen has been saving to
-- six columns that never existed on profiles. Every toggle appeared to
-- save successfully (saveSettings never checked for an error, so a
-- rejected update silently proceeded straight to a false "Saved"
-- confirmation) while nothing was ever actually persisted.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_private        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_location     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_tagging     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_leaderboard  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_messages    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_analytics    boolean NOT NULL DEFAULT true;

-- Leaderboard filter: exclude anyone who's opted out, everywhere a
-- ranking is shown, not just some of the places.

-- (Enforcement for allow_tagging is added via the mention trigger, below.)
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
  mentioned_allows_tagging boolean;
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
    SELECT id, allow_tagging INTO mentioned_id, mentioned_allows_tagging
    FROM profiles WHERE lower(handle) = h;

    IF mentioned_id IS NOT NULL
       AND mentioned_id <> actor
       AND mentioned_allows_tagging = true
       AND NOT is_blocked_either_way(mentioned_id) THEN
      INSERT INTO notifications (user_id, actor_id, type, spot_id, comment_text, read)
      VALUES (mentioned_id, actor, 'mention', target_spot_id, full_text, false);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;