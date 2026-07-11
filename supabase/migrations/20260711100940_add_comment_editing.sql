-- Allows users to edit their own comments (RLS previously had no UPDATE
-- policy at all for comments, so this was genuinely impossible before).
-- An edited_at timestamp is auto-set via trigger whenever the text
-- actually changes, so the "(edited)" indicator can't be spoofed by the
-- client and doesn't need the app to remember to set it correctly.

ALTER TABLE "public"."comments" ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone;

CREATE POLICY "Users update own comments" ON "public"."comments"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION "public"."set_comment_edited_at"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.text IS DISTINCT FROM OLD.text THEN
    NEW.edited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_set_comment_edited_at"
  BEFORE UPDATE ON "public"."comments"
  FOR EACH ROW EXECUTE FUNCTION "public"."set_comment_edited_at"();