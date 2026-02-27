CREATE TABLE IF NOT EXISTS public_event_conversations (
  id text PRIMARY KEY,
  barbecue_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  organizer_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_user_id integer REFERENCES users(id) ON DELETE CASCADE,
  participant_email text,
  participant_label text,
  status text NOT NULL DEFAULT 'pending',
  last_message_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_event_conversations_event_organizer_participant_idx
  ON public_event_conversations (barbecue_id, organizer_user_id, participant_user_id)
  WHERE participant_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public_event_messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public_event_conversations(id) ON DELETE CASCADE,
  sender_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp DEFAULT now(),
  read_at timestamp
);

CREATE INDEX IF NOT EXISTS public_event_messages_conversation_created_idx
  ON public_event_messages (conversation_id, created_at DESC);
