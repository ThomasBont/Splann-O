ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id uuid DEFAULT gen_random_uuid();

UPDATE event_chat_messages
SET client_message_id = gen_random_uuid()
WHERE client_message_id IS NULL;

ALTER TABLE event_chat_messages
  ALTER COLUMN client_message_id SET NOT NULL;

ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE event_chat_messages
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'UTC';

ALTER TABLE event_chat_messages
  ALTER COLUMN created_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS event_chat_messages_event_client_message_id_unique
  ON event_chat_messages (event_id, client_message_id);

