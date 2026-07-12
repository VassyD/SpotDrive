-- Per-user rate limiting, enforced at the database level (not trusted to
-- app code) via a generic, reusable check-and-log function plus a shared
-- trigger function parameterized per table. A sliding window (count of
-- actions in the last N seconds from now), not a fixed calendar bucket.

CREATE TABLE IF NOT EXISTS "public"."rate_limit_log" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "user_id" uuid NOT NULL,
  "action_type" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_rate_limit_log_user_action_time"
  ON "public"."rate_limit_log" ("user_id", "action_type", "created_at");

ALTER TABLE "public"."rate_limit_log" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view rate limit log" ON "public"."rate_limit_log"
  FOR SELECT USING (is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION "public"."check_rate_limit"(
  p_user_id uuid, p_action_type text, p_max_count int, p_window_seconds int
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.rate_limit_log
  WHERE user_id = p_user_id AND action_type = p_action_type
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  IF recent_count >= p_max_count THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_log (user_id, action_type) VALUES (p_user_id, p_action_type);
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."enforce_rate_limit"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_type text := TG_ARGV[0];
  v_max_count int := TG_ARGV[1]::int;
  v_window_seconds int := TG_ARGV[2]::int;
  v_allowed boolean;
BEGIN
  SELECT public.check_rate_limit(NEW.user_id, v_action_type, v_max_count, v_window_seconds) INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded for %: max % per % seconds', v_action_type, v_max_count, v_window_seconds;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_rate_limit_spots"
  BEFORE INSERT ON "public"."spots"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rate_limit"('spot_post', '10', '3600');

CREATE TRIGGER "trg_rate_limit_comments"
  BEFORE INSERT ON "public"."comments"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rate_limit"('comment', '30', '3600');

CREATE TRIGGER "trg_rate_limit_likes"
  BEFORE INSERT ON "public"."likes"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rate_limit"('like', '100', '3600');

CREATE TRIGGER "trg_rate_limit_reports"
  BEFORE INSERT ON "public"."reports"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rate_limit"('report', '20', '3600');