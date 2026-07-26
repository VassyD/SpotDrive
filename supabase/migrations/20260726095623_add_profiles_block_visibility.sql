-- Blocking hid a blocked user's spots, comments, and stories from each
-- other, but the profiles table itself was never covered — meaning a
-- blocked user could still be found via search, tapped into directly,
-- or shown in the leaderboard/trending lists. Since profiles.id IS the
-- user (not a foreign key to one, unlike spots/comments/stories), this
-- single policy covers every place a profile gets queried: search,
-- direct profile views, leaderboard, trending spotters, etc.

CREATE POLICY "Hide blocked users profiles from each other"
ON profiles
AS RESTRICTIVE
FOR SELECT
USING (NOT is_blocked_either_way(id));