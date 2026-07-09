-- Extends the existing handle_new_user trigger to also populate
-- profile_private_info from signup metadata (date_of_birth, town, state,
-- country). This avoids a real timing problem: since signup requires email
-- confirmation, the user isn't authenticated yet right after signUp() runs,
-- so a client-side RLS-protected insert would fail (no session exists yet).
-- Running this inside the trigger (SECURITY DEFINER, same transaction as
-- account creation) sidesteps that entirely.

CREATE OR REPLACE FUNCTION "public"."handle_new_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
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
$$;