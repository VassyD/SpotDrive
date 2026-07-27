-- Direct Messages v1: 1:1 conversations, text + photo attachments, read receipts.
-- Blocking hides an existing conversation from both parties and blocks new
-- messages entirely, consistent with every other content type this session.

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_ordered_pair CHECK (user_a_id < user_b_id),
  CONSTRAINT conversations_unique_pair UNIQUE (user_a_id, user_b_id)
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text text,
  photo_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_has_content CHECK (text IS NOT NULL OR photo_url IS NOT NULL)
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_conversations_user_a ON conversations(user_a_id);
CREATE INDEX idx_conversations_user_b ON conversations(user_b_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- A user can only see/act on conversations they're actually part of.
CREATE POLICY "Users view own conversations"
ON conversations FOR SELECT
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users create conversations they're part of"
ON conversations FOR INSERT
WITH CHECK (
  (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  AND user_a_id <> user_b_id
);

-- Blocking hides an existing conversation from both parties entirely.
CREATE POLICY "Hide conversations between blocked users"
ON conversations
AS RESTRICTIVE
FOR SELECT
USING (
  NOT is_blocked_either_way(CASE WHEN auth.uid() = user_a_id THEN user_b_id ELSE user_a_id END)
);

CREATE POLICY "Block starting a conversation between blocked users"
ON conversations
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  NOT is_blocked_either_way(CASE WHEN auth.uid() = user_a_id THEN user_b_id ELSE user_a_id END)
);

-- Messages: only visible to/sendable by an actual participant in the
-- conversation, and inherit the same blocking restriction.
CREATE POLICY "Users view messages in their own conversations"
ON messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
  )
);

CREATE POLICY "Users send messages as themselves in their own conversations"
ON messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
  )
);

CREATE POLICY "Hide messages between blocked users"
ON messages
AS RESTRICTIVE
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND NOT is_blocked_either_way(CASE WHEN auth.uid() = c.user_a_id THEN c.user_b_id ELSE c.user_a_id END)
  )
);

CREATE POLICY "Block sending messages between blocked users"
ON messages
AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND NOT is_blocked_either_way(CASE WHEN auth.uid() = c.user_a_id THEN c.user_b_id ELSE c.user_a_id END)
  )
);

-- Recipient (not sender) can mark their own received messages as read.
CREATE POLICY "Recipients can mark messages as read"
ON messages FOR UPDATE
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
    AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
  )
)
WITH CHECK (sender_id <> auth.uid());

-- Real-time notification on new message, same pattern as likes/comments/follows.
CREATE OR REPLACE FUNCTION notify_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT CASE WHEN c.user_a_id = NEW.sender_id THEN c.user_b_id ELSE c.user_a_id END
  INTO recipient
  FROM conversations c WHERE c.id = NEW.conversation_id;

  INSERT INTO notifications (user_id, actor_id, type, spot_id, comment_text, read)
  VALUES (recipient, NEW.sender_id, 'message', NULL, COALESCE(NEW.text, '📷 Photo'), false);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_message
AFTER INSERT ON messages
FOR EACH ROW EXECUTE FUNCTION notify_on_message();

ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['like'::text, 'save'::text, 'comment'::text, 'follow'::text, 'mention'::text, 'message'::text]));

-- Storage: allow a 4th top-level folder for message photo attachments,
-- reusing the exact ownership-check pattern from the security-hardening pass.
DROP POLICY "Auth users can upload" ON storage.objects;

CREATE POLICY "Auth users can upload"
ON storage.objects
FOR INSERT
WITH CHECK (
  (bucket_id = 'spot-photos'::text)
  AND (auth.role() = 'authenticated'::text)
  AND (
    (
      (storage.foldername(name))[1] = ANY (ARRAY['spots'::text, 'stories'::text, 'messages'::text])
      AND (storage.foldername(name))[2] = (auth.uid())::text
    )
    OR (
      (storage.foldername(name))[1] = 'avatars'::text
      AND left(
        split_part(name, '/', array_length(string_to_array(name, '/'), 1)),
        length((auth.uid())::text)
      ) = (auth.uid())::text
    )
  )
);