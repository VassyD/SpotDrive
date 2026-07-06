-- Fixes a systemic bug: spots, comments, follows, and stories all had their
-- user_id / follower_id / following_id foreign keys pointing at auth.users
-- instead of public.profiles. Since profiles.id is itself an FK to
-- auth.users (1:1, one profile per user via the handle_new_user trigger),
-- repointing these to profiles is safe and semantically equivalent — but
-- critically, it's what PostgREST needs to detect the relationship and
-- allow embedded queries like `.select("*, profiles(handle, avatar_url)")`.
--
-- Without this, every embedded profile query silently failed with
-- PGRST200 ("Could not find a relationship..."), which is why the main
-- feed, pagination, and real-time inserts were falling back to mock data.

ALTER TABLE "public"."spots" DROP CONSTRAINT "spots_user_id_fkey";
ALTER TABLE "public"."spots"
  ADD CONSTRAINT "spots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."comments" DROP CONSTRAINT "comments_user_id_fkey";
ALTER TABLE "public"."comments"
  ADD CONSTRAINT "comments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."follows" DROP CONSTRAINT "follows_follower_id_fkey";
ALTER TABLE "public"."follows"
  ADD CONSTRAINT "follows_follower_id_fkey"
  FOREIGN
KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."follows" DROP CONSTRAINT "follows_following_id_fkey";
ALTER TABLE "public"."follows"
  ADD CONSTRAINT "follows_following_id_fkey"
  FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE "public"."stories" DROP CONSTRAINT "stories_user_id_fkey";
ALTER TABLE "public"."stories"
  ADD CONSTRAINT "stories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;