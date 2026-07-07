-- Fixes drift in profiles.followers_count / following_count caused by
-- FollowButton's client code manually incrementing/decrementing these
-- columns IN ADDITION TO the existing on_follow_change trigger, which
-- already does this correctly and atomically. Every follow/unfollow was
-- being double-counted. Recompute both columns from the real follows rows
-- to correct any accumulated drift.

UPDATE "public"."profiles" SET
  followers_count = (SELECT count(*) FROM public.follows WHERE following_id = profiles.id),
  following_count = (SELECT count(*) FROM public.follows WHERE follower_id = profiles.id);