CREATE TABLE IF NOT EXISTS polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES event_chat_messages(id) ON DELETE CASCADE,
  created_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  question text NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS polls_message_id_unique
  ON polls (message_id);

CREATE INDEX IF NOT EXISTS polls_event_idx
  ON polls (event_id, created_at);

CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_options_poll_position_unique
  ON poll_options (poll_id, position);

CREATE INDEX IF NOT EXISTS poll_options_poll_idx
  ON poll_options (poll_id, position);

CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS poll_votes_poll_user_unique
  ON poll_votes (poll_id, user_id);

CREATE INDEX IF NOT EXISTS poll_votes_poll_idx
  ON poll_votes (poll_id);

CREATE INDEX IF NOT EXISTS poll_votes_option_idx
  ON poll_votes (option_id);
