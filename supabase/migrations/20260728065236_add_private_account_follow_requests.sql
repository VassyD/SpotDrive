-- Private Account, real version. Following a private account creates a
-- pending request instead of an instant follow. Content-hiding is
-- enforced identically across spots/stories/spot_media, matching every
-- other visibility rule (blocking, shadow-ban, status) this session.

CREATE TABLE follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT follow_requests_not_self CHECK (requester_id <> target_id),
  CONSTRAINT follow_requests_unique_pair UNIQUE (requester_id, target_id)
);

CREATE INDEX idx_follow_requests_target ON follow_requests(target_id);
CREATE INDEX idx_follow_requests_requester ON follow_requests(requester_id);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sent or received requests"
ON follow_requests FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users request to follow, only if target is actually private"
ON follow_requests FOR INSERT
WITH CHECK (
  auth.uid() = requester_id
  AND EXISTS (SELECT 1 FROM profiles WHERE id = target_id AND is_private = true)
);

CREATE POLICY "Requester cancels or target denies"
ON follow_requests FOR DELETE
USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Hide requests between blocked users"
ON follow_requests
AS RESTRICTIVE
FOR SELECT
USING (
  NOT is_blocked_either_way(CASE WHEN auth.uid() = requester_id THEN target_id ELSE requester_id END)
);

CREATE POLICY "Block requesting to follow a blocked user"
ON follow_requests
AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_blocked_either_way(target_id));

-- Atomically accept: create the real follow, remove the request. Only
-- the request's target can call this.
CREATE OR REPLACE FUNCTION accept_follow_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
BEGIN
  SELECT * INTO req FROM follow_requests WHERE id = request_id AND target_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not yours to accept';
  END IF;

  INSERT INTO follows (follower_id, following_id) VALUES (req.requester_id, req.target_id);
  DELETE FROM follow_requests WHERE id = request_id;
END;
$$;

-- Reusable check: can the current viewer see this owner's private content?
CREATE OR REPLACE FUNCTION can_view_private_content(owner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    auth.uid() = owner_id
    OR is_admin_user(auth.uid())
    OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = owner_id AND is_private = true)
    OR EXISTS (SELECT 1 FROM follows WHERE follower_id = auth.uid() AND following_id = owner_id)
$$;

CREATE POLICY "Hide private account spots from non-approved-followers"
ON spots AS RESTRICTIVE FOR SELECT
USING (can_view_private_content(user_id));

CREATE POLICY "Hide private account stories from non-approved-followers"
ON stories AS RESTRICTIVE FOR SELECT
USING (can_view_private_content(user_id));

CREATE POLICY "Hide private account spot media from non-approved-followers"
ON spot_media AS RESTRICTIVE FOR SELECT
USING (can_view_private_content(user_id));