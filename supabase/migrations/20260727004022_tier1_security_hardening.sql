-- ============================================================
-- Tier 1 security hardening (full app audit, security depth)
-- ============================================================

-- 1. spots: hidden/removed content was never actually enforced by
-- RLS at all — only filtered client-side via .eq("status","live").
-- Owner and admins can still see their own hidden spots.
CREATE POLICY "Hide non-live spots from non-owners"
ON spots
AS RESTRICTIVE
FOR SELECT
USING (
  status = 'live'
  OR auth.uid() = user_id
  OR is_admin_user(auth.uid())
);

-- 2. storage.objects: upload had no path-ownership check at all,
-- unlike delete. Now mirrors it for spots/stories (2-level paths),
-- and separately handles avatars' flat "avatars/{userId}.ext" shape.
DROP POLICY "Auth users can upload" ON storage.objects;

CREATE POLICY "Auth users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  (bucket_id = 'spot-photos'::text)
  AND (auth.role() = 'authenticated'::text)
  AND (
    (
      (storage.foldername(name))[1] = ANY (ARRAY['spots'::text, 'stories'::text])
      AND (storage.foldername(name))[2] = (auth.uid())::text
    )
    OR (
      (storage.foldername(name))[1] = 'avatars'::text
      AND left(
        split_part(name, '/', array_length(string_to_array(name, '/'), 1)),
        length((auth.uid())::text)
      ) = (auth.uid())::text
    )
  )
);

-- 3. comments: shadow-banned users' comments were never hidden,
-- unlike spots/stories. Same pattern as those.
CREATE POLICY "Hide shadow-banned users comments from others"
ON comments
AS RESTRICTIVE
FOR SELECT
USING (
  (NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = comments.user_id AND profiles.is_shadow_banned = true
  )) OR (auth.uid() = user_id)
);

-- 4. spot_media: had zero blocking/shadow-ban/status coverage at
-- all — directly queryable by spot_id regardless of the parent
-- spot's visibility to the viewer. All three gaps closed at once.
CREATE POLICY "Hide spot media between blocked users"
ON spot_media
AS RESTRICTIVE
FOR SELECT
USING (NOT is_blocked_either_way(user_id));

CREATE POLICY "Hide shadow-banned users spot media from others"
ON spot_media
AS RESTRICTIVE
FOR SELECT
USING (
  (NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = spot_media.user_id AND profiles.is_shadow_banned = true
  )) OR (auth.uid() = user_id)
);

CREATE POLICY "Hide spot media for non-live spots from non-owners"
ON spot_media
AS RESTRICTIVE
FOR SELECT
USING (
  auth.uid() = user_id
  OR is_admin_user(auth.uid())
  OR EXISTS (
    SELECT 1 FROM spots
    WHERE spots.id = spot_media.spot_id AND spots.status = 'live'
  )
);

-- 5. Missing indexes on columns hit by RLS policies and common
-- queries on every request. Zero risk given current row counts.
CREATE INDEX idx_spots_user_id ON spots (user_id);
CREATE INDEX idx_spots_status ON spots (status);
CREATE INDEX idx_comments_spot_id ON comments (spot_id);
CREATE INDEX idx_comments_user_id ON comments (user_id);
CREATE INDEX idx_stories_expires_at ON stories (expires_at);
CREATE INDEX idx_stories_user_id ON stories (user_id);
CREATE INDEX idx_notifications_user_id ON notifications (user_id);
CREATE INDEX idx_spot_media_spot_id ON spot_media (spot_id);
CREATE INDEX idx_follows_following_id ON follows (following_id);