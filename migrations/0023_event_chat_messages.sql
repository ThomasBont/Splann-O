CREATE TABLE IF NOT EXISTS event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  author_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  author_name text,
  author_avatar_url text,
  type text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_chat_messages_event_created_at_idx
  ON event_chat_messages (event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS event_chat_messages_event_id_idx
  ON event_chat_messages (event_id, id);
