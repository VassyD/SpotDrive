-- Allows admins to delete any comment (needed for the admin panel's
-- comment-report moderation action). Uses the existing is_admin_user()
-- helper, consistent with the spots/profiles admin policies.
CREATE POLICY "Admins can delete any comment" ON "public"."comments"
  FOR DELETE USING (is_admin_user(auth.uid()));
