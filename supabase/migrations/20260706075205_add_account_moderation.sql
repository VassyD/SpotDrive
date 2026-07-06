-- Account moderation: ban, temporary suspension, and shadow ban.

ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false;
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "suspended_until" timestamp with time zone;
ALTER TABLE "public"."profiles" ADD COLUMN IF NOT EXISTS "is_shadow_banned" boolean DEFAULT false;

-- Helper: true if the given user is neither banned nor currently suspended.
-- Returns true for NULL (anon / no profile row), so it never blocks anon reads.
CREATE OR REPLACE FUNCTION "public"."is_active_user"(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = uid
      AND (is_banned = true OR (suspended_until IS NOT NULL AND suspended_until > now()))
  );
$$;

-- Restrictive policies: these AND with every existing permissive policy on
-- the same table/command, so a banned/suspended user is blocked from
-- inserting regardless of which permissive policy would otherwise allow it.
CREATE POLICY "Block banned or suspended users from posting spots" ON "public"."spots"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE POLICY "Block banned or suspended users from commenting" ON "public"."comments"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE POLICY "Block banned or suspended users from following" ON "public"."follows"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE POLICY "Block banned or suspended users from posting stories" ON "public"."stories"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

CREATE POLICY "Block banned or suspended users from reporting" ON "public"."reports"
  AS RESTRICTIVE FOR INSERT WITH CHECK (is_active_user(auth.uid()));

-- Shadow ban: hides a shadow-banned user's spots from everyone except
-- themselves. Restrictive, so it ANDs with the existing "viewable by
-- everyone" permissive policy rather than replacing it.
CREATE POLICY "Hide shadow-banned users spots from others" ON "public"."spots"
  AS RESTRICTIVE FOR SELECT USING (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = spots.user_id AND is_shadow_banned = true
    )
    OR auth.uid() = user_id
  );