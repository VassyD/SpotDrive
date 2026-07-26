-- The "Blocked Users" settings screen joins blocks -> profiles to show
-- each blocked person's handle. Since blocking now hides profiles from
-- each other (fixing the search-bar/leaderboard gap), that same join
-- returns null for the blocked person's profile, showing "Unknown" in
-- your own blocked-users list. Loosening the profiles policy isn't safe
-- here - RLS can't distinguish "this is the blocked-users settings
-- screen" from "this is the search bar", so any exception would reopen
-- the exact hole just closed. Instead: a narrow SECURITY DEFINER
-- function, hard-scoped to only ever return the caller's own blocks.

CREATE OR REPLACE FUNCTION get_my_blocked_users()
RETURNS TABLE (
  block_id uuid,
  blocked_id uuid,
  handle text,
  avatar_url text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT b.id, b.blocked_id, p.handle, p.avatar_url
  FROM blocks b
  JOIN profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_blocked_users() TO authenticated;
