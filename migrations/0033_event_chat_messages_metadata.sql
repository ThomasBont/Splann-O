-- Add structured metadata to chat messages (used for rich system message cards).
ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS metadata json DEFAULT null;

