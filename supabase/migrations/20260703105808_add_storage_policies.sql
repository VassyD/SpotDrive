CREATE POLICY "Anyone can view photos" ON "storage"."objects" 
  FOR SELECT USING (("bucket_id" = 'spot-photos'::"text"));

CREATE POLICY "Auth users can upload" ON "storage"."objects" 
  FOR INSERT WITH CHECK ((
    ("bucket_id" = 'spot-photos'::"text") 
    AND ("auth"."role"() = 'authenticated'::"text") 
    AND (("storage"."foldername"("name"))[1] = ANY (ARRAY['spots'::"text", 'avatars'::"text", 'stories'::"text"]))
  ));

CREATE POLICY "Users delete own files" ON "storage"."objects" 
  FOR DELETE USING ((
    ("bucket_id" = 'spot-photos'::"text") 
    AND (("auth"."uid"())::"text" = ("storage"."foldername"("name"))[2])
  ));