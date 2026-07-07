-- Allows users to see reports THEY submitted (not reports made against
-- them, which stay admin-only). Needed for the "Download My Data" export
-- to include a user's own moderation actions.
CREATE POLICY "Users can view own submitted reports" ON "public"."reports"
  FOR SELECT USING (auth.uid() = reporter_id);