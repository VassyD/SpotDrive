-- Verified Spotter badge: permanent by construction. The trigger's own
-- condition (OLD.verified_spotter_at IS NULL) means it can only ever
-- fire once per user - not "we chose not to build an unset path," but
-- structurally incapable of unsetting it once earned.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_spotter_at timestamptz;

CREATE OR REPLACE FUNCTION check_verified_spotter()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.spots_count >= 50 AND OLD.verified_spotter_at IS NULL THEN
    NEW.verified_spotter_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_verified_spotter
BEFORE UPDATE OF spots_count ON profiles
FOR EACH ROW EXECUTE FUNCTION check_verified_spotter();

-- City leaderboard: live-computed, current calendar month only, no
-- stored period state or reset job. Deliberately exposes ONLY town
-- from profile_private_info - never DOB, state, or country. Excludes
-- blocked and shadow-banned users, same as every other leaderboard
-- and search surface in the app.

CREATE OR REPLACE FUNCTION get_city_leaderboard(target_city text)
RETURNS TABLE (
  user_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  verified_spotter_at timestamptz,
  spot_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.handle,
    p.display_name,
    p.avatar_url,
    p.verified_spotter_at,
    COUNT(s.id) AS spot_count
  FROM profiles p
  JOIN profile_private_info ppi ON ppi.user_id = p.id
  LEFT JOIN spots s ON s.user_id = p.id
    AND s.status = 'live'
    AND s.created_at >= date_trunc('month', now())
  WHERE ppi.town = target_city
    AND NOT p.is_shadow_banned
    AND NOT is_blocked_either_way(p.id)
  GROUP BY p.id, p.handle, p.display_name, p.avatar_url, p.verified_spotter_at
  ORDER BY spot_count DESC, p.handle ASC
  LIMIT 50;
$$;