-- Mirror the existing spots moderation-visibility policies onto stories.
-- Previously: blocking a user hid their spots and comments, but not their
-- stories. Shadow-banned users' spots were invisibly hidden from everyone,
-- but their stories weren't. This closes that gap.

CREATE POLICY "Hide stories between blocked users"
ON stories
AS RESTRICTIVE
FOR SELECT
USING (NOT is_blocked_either_way(user_id));

CREATE POLICY "Hide shadow-banned users stories from others"
ON stories
AS RESTRICTIVE
FOR SELECT
USING (
  (NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = stories.user_id AND profiles.is_shadow_banned = true
  )) OR (auth.uid() = user_id)
);