-- Bug found via CI: enforce_rate_limit() hardcoded NEW.user_id, but the
-- reports table's submitter column is actually named reporter_id, not
-- user_id — causing every report insert to fail with "undefined column".
-- Fixed by accepting the id column name as a 4th trigger argument,
-- defaulting to 'user_id' for the tables that already use it, extracted
-- dynamically via to_jsonb(NEW) so the function works across any column
-- name without needing a separate copy per table.

CREATE OR REPLACE FUNCTION "public"."enforce_rate_limit"()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action_type text := TG_ARGV[0];
  v_max_count int := TG_ARGV[1]::int;
  v_window_seconds int := TG_ARGV[2]::int;
  v_id_column text := COALESCE(TG_ARGV[3], 'user_id');
  v_user_id uuid;
  v_allowed boolean;
BEGIN
  v_user_id := (to_jsonb(NEW) ->> v_id_column)::uuid;
  SELECT public.check_rate_limit(v_user_id, v_action_type, v_max_count, v_window_seconds) INTO v_allowed;
  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Rate limit exceeded for %: max % per % seconds', v_action_type, v_max_count, v_window_seconds;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "trg_rate_limit_reports" ON "public"."reports";
CREATE TRIGGER "trg_rate_limit_reports"
  BEFORE INSERT ON "public"."reports"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_rate_limit"('report', '20', '3600', 'reporter_id');
