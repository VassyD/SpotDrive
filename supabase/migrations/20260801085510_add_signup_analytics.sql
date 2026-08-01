-- Minimal analytics v1: signup funnel drop-off + attribution. Directly
-- answers the two items flagged as blocking in the Marketing review.
-- No PII stored - anon_id is a client-generated random ID, not tied to
-- any account (there is no account yet at the moment this fires).

CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['signup_started'::text])),
  anon_id text NOT NULL,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_created_at ON events(created_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a signup-started event"
ON events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Only admins can read events"
ON events FOR SELECT
USING (is_admin_user(auth.uid()));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signup_utm_source   text,
  ADD COLUMN IF NOT EXISTS signup_utm_medium   text,
  ADD COLUMN IF NOT EXISTS signup_utm_campaign text;

-- Extend handle_new_user to also capture attribution at signup time,
-- same optional-metadata pattern already used for DOB/town/state/country.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, handle, display_name, signup_utm_source, signup_utm_medium, signup_utm_campaign)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'utm_source', ''),
    nullif(new.raw_user_meta_data->>'utm_medium', ''),
    nullif(new.raw_user_meta_data->>'utm_campaign', '')
  );

  insert into public.profile_private_info (user_id, date_of_birth, town, state, country)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'town', ''),
    nullif(new.raw_user_meta_data->>'state', ''),
    nullif(new.raw_user_meta_data->>'country', '')
  );

  return new;
end;
$function$;

-- Real bug found and fixed: RLS policies alone aren't enough - Postgres
-- requires a baseline table-level GRANT before RLS is even evaluated.
-- Every other table in this project only ever gets written to by an
-- authenticated session; this is the first one needing a fully
-- unauthenticated (anon) write, which is why this was missed.
GRANT INSERT ON events TO anon, authenticated;
GRANT SELECT ON events TO authenticated;