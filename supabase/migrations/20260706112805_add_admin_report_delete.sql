-- Allows admins to permanently delete report records (e.g. clearing out
-- old dismissed reports from the admin panel).
CREATE POLICY "Admins can delete any report" ON "public"."reports"
  FOR DELETE USING (is_admin_user(auth.uid()));
