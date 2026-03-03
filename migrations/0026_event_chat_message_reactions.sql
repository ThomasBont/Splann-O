CREATE TABLE IF NOT EXISTS event_chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES event_chat_messages(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_chat_message_reactions_message_emoji_idx
  ON event_chat_message_reactions (message_id, emoji);

CREATE UNIQUE INDEX IF NOT EXISTS event_chat_message_reactions_message_user_emoji_unique
  ON event_chat_message_reactions (message_id, user_id, emoji);
