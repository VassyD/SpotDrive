-- Private, backend-only demographic data (date of birth, location) collected
-- at signup for consumer/marketing understanding. Deliberately a SEPARATE
-- table from profiles (which has a "viewable by everyone" policy) so this
-- stays private at the database level rather than relying on the app never
-- selecting these columns for other users. Age is intentionally NOT stored
-- — it's computed on demand from date_of_birth so it's always correct
-- without needing yearly maintenance.

CREATE TABLE IF NOT EXISTS "public"."profile_private_info" (
  "user_id" uuid NOT NULL PRIMARY KEY REFERENCES "public"."profiles"("id") ON DELETE CASCADE,
  "date_of_birth" date,
  "town" text,
  "state" text,
  "country" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "public"."profile_private_info" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own private info" ON "public"."profile_private_info"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own private info" ON "public"."profile_private_info"
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own private info" ON "public"."profile_private_info"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all private info" ON "public"."profile_private_info"
  FOR SELECT USING (is_admin_user(auth.uid()));