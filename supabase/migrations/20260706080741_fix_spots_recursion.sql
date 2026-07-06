-- Fixes "infinite recursion detected in policy for relation spots".
-- The original "max 50 spots per user" policy queried spots.count(*)
-- directly inside its own WITH CHECK, which is itself subject to spots'
-- RLS policies. Once we added more policies to spots, Postgres could no
-- longer prove that self-referencing subquery terminates. Moving the count
-- into a SECURITY DEFINER function bypasses RLS for that internal query,
-- breaking the cycle.

CREATE OR REPLACE FUNCTION "public"."count_user_spots"(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.spots WHERE user_id = uid;
$$;

DROP POLICY "max 50 spots per user" ON "public"."spots";
CREATE POLICY "max 50 spots per user" ON "public"."spots"
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND count_user_spots(auth.uid()) < 50
  );