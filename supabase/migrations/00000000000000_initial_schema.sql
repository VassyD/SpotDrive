


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'handle', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hide_reported_spot"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if NEW.report_count >= 5 then
    update spots set status = 'hidden' where id = NEW.id;
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."hide_reported_spot"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_follow_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if TG_OP = 'INSERT' then
    -- Increment follower count for the person being followed
    update profiles set followers_count = followers_count + 1
      where id = NEW.following_id;
    -- Increment following count for the person who followed
    update profiles set following_count = following_count + 1
      where id = NEW.follower_id;
  elsif TG_OP = 'DELETE' then
    -- Decrement follower count
    update profiles set followers_count = greatest(0, followers_count - 1)
      where id = OLD.following_id;
    -- Decrement following count
    update profiles set following_count = greatest(0, following_count - 1)
      where id = OLD.follower_id;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."update_follow_counts"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "spot_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "likes_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "handle" "text" NOT NULL,
    "display_name" "text",
    "avatar_url" "text",
    "bio" "text" DEFAULT ''::"text",
    "followers_count" integer DEFAULT 0,
    "following_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "make" "text" NOT NULL,
    "model" "text" NOT NULL,
    "year" integer,
    "rarity" "text" DEFAULT 'Exotic'::"text",
    "color" "text" DEFAULT ''::"text",
    "location_name" "text" DEFAULT ''::"text",
    "description" "text" DEFAULT ''::"text",
    "image_url" "text",
    "likes_count" integer DEFAULT 0,
    "saves_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'live'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reported" boolean DEFAULT false,
    "report_count" integer DEFAULT 0
);


ALTER TABLE "public"."spots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "make" "text" DEFAULT ''::"text",
    "model" "text" DEFAULT ''::"text",
    "rarity" "text" DEFAULT 'Sports'::"text",
    "location_name" "text" DEFAULT ''::"text",
    "expires_at" timestamp with time zone NOT NULL,
    "views_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stories" OWNER TO "postgres";


ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_following_id_key" UNIQUE ("follower_id", "following_id");



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spots"
    ADD CONSTRAINT "spots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "on_follow_change" AFTER INSERT OR DELETE ON "public"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."update_follow_counts"();



CREATE OR REPLACE TRIGGER "on_spot_reported" AFTER UPDATE OF "report_count" ON "public"."spots" FOR EACH ROW EXECUTE FUNCTION "public"."hide_reported_spot"();



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_spot_id_fkey" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follows"
    ADD CONSTRAINT "follows_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spots"
    ADD CONSTRAINT "spots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stories"
    ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can view follows" ON "public"."follows" FOR SELECT USING (true);



CREATE POLICY "Auth users can comment" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Auth users post stories" ON "public"."stories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Comments viewable by everyone" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Only live stories visible" ON "public"."stories" FOR SELECT USING (("expires_at" > "now"()));



CREATE POLICY "Profiles viewable by everyone" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Spots viewable by everyone" ON "public"."spots" FOR SELECT USING (true);



CREATE POLICY "Stories viewable by everyone" ON "public"."stories" FOR SELECT USING (true);



CREATE POLICY "Users delete own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own spots" ON "public"."spots" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own stories" ON "public"."stories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users insert own spots" ON "public"."spots" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own follows" ON "public"."follows" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users update own spots" ON "public"."spots" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "max 50 spots per user" ON "public"."spots" FOR INSERT WITH CHECK ((( SELECT "count"(*) AS "count"
   FROM "public"."spots" "spots_1"
  WHERE ("spots_1"."user_id" = "auth"."uid"())) < 50));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stories" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hide_reported_spot"() TO "anon";
GRANT ALL ON FUNCTION "public"."hide_reported_spot"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."hide_reported_spot"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_follow_counts"() TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."spots" TO "anon";
GRANT ALL ON TABLE "public"."spots" TO "authenticated";
GRANT ALL ON TABLE "public"."spots" TO "service_role";



GRANT ALL ON TABLE "public"."stories" TO "anon";
GRANT ALL ON TABLE "public"."stories" TO "authenticated";
GRANT ALL ON TABLE "public"."stories" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







