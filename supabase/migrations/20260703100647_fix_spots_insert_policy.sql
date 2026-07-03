DROP POLICY "max 50 spots per user" ON "public"."spots";

CREATE POLICY "max 50 spots per user" ON "public"."spots"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (SELECT count(*) FROM spots WHERE user_id = auth.uid()) < 50
  );