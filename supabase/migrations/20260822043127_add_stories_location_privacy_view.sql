-- Extend Show Location enforcement to stories, same physical-safety
-- rationale as spots. Reuses can_view_location(owner_id) unchanged -
-- it is fully generic, no story-specific logic needed.

CREATE OR REPLACE VIEW stories_with_location_privacy
WITH (security_invoker = true) AS
SELECT
  s.id, s.user_id, s.image_url, s.make, s.model, s.rarity,
  CASE WHEN can_view_location(s.user_id) THEN s.location_name ELSE NULL END AS location_name,
  s.expires_at, s.views_count, s.created_at,
  p.handle, p.avatar_url, p.display_name
FROM stories s
LEFT JOIN profiles p ON p.id = s.user_id;

GRANT SELECT ON stories_with_location_privacy TO anon, authenticated;

NOTIFY pgrst, 'reload schema';