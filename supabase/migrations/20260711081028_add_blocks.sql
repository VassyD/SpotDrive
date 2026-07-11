-- Blocking: invisible to the blocked person (they're never notified), and
-- mutual — blocking someone hides their content from you AND yours from
-- them. Blocking also auto-removes any existing follow relationship in
-- either direction.

CREATE TABLE IF NOT EXISTS "public"."blocks" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "blocker_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "blocked_id" uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE ("blocker_id", "blocked_id"),
  CHECK ("blocker_id" <> "blocked_id")
);

ALTER TABLE "public"."blocks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blocks" ON "public"."blocks"
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Admins can view all blocks" ON "public"."blocks"
  FOR SELECT USING (is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION "public"."remove_follows_on_block"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_remove_follows_on_block"
  AFTER INSERT ON "public"."blocks"
  FOR EACH ROW EXECUTE FUNCTION "public"."remove_follows_on_block"();

CREATE OR REPLACE FUNCTION "public"."is_blocked_either_way"(other_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = other_user)
       OR (blocker_id = other_user AND blocked_id = auth.uid())
  );
$$;

CREATE POLICY "Hide spots between blocked users" ON "public"."spots"
  AS RESTRICTIVE FOR SELECT USING (NOT is_blocked_either_way(user_id));

CREATE POLICY "Hide comments between blocked users" ON "public"."comments"
  AS RESTRICTIVE FOR SELECT USING (NOT is_blocked_either_way(user_id));