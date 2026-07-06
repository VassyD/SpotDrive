-- Missing piece: we added "admin can update any spot"/"any report" policies,
-- but never one for profiles itself — so ban/suspend/shadow-ban updates in
-- the admin panel were silently blocked by RLS (no matching UPDATE policy
-- for a non-owner), even though the UI optimistically showed success.
--
-- Uses a SECURITY DEFINER function (rather than an inline subquery on
-- profiles) to avoid the same self-referencing recursion issue we hit
-- and fixed on the spots table earlier this session.

CREATE OR REPLACE FUNCTION "public"."is_admin_user"(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND is_admin = true
  );
$$;

CREATE POLICY "Admins can update any profile" ON "public"."profiles"
  FOR UPDATE USING (is_admin_user(auth.uid()));