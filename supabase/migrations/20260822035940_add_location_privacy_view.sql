-- Show Location enforcement, real data-layer version. location_name
-- lives directly on spots as a column - Postgres RLS can restrict which
-- ROWS you see, but not individual columns within a row you're
-- otherwise allowed to see. So this is built as a security_invoker
-- view, not an RLS policy. Without security_invoker, the view would
-- run as its owner (postgres, which bypasses RLS entirely) and
-- silently reopen every moderation/visibility rule already built.

CREATE OR REPLACE FUNCTION can_view_location(owner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    auth.uid() = owner_id
    OR is_admin_user(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND show_location = false)
    OR EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = owner_id)
$$;

CREATE OR REPLACE VIEW spots_with_location_privacy
WITH (security_invoker = true) AS
SELECT
  s.id, s.user_id, s.make, s.model, s.year, s.rarity, s.color,
  CASE WHEN can_view_location(s.user_id) THEN s.location_name ELSE NULL END AS location_name,
  s.description, s.image_url, s.likes_count, s.saves_count, s.comments_count,
  s.status, s.created_at, s.reported, s.report_count,
  p.handle, p.avatar_url, p.display_name
FROM spots s
LEFT JOIN profiles p ON p.id = s.user_id;

GRANT SELECT ON spots_with_location_privacy TO anon, authenticated;

NOTIFY pgrst, 'reload schema';