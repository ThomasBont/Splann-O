-- Phase 1: migrate username-based identity columns to integer user-id foreign keys.
-- Safe backfill behavior: unmatched usernames become NULL (no migration failure).

BEGIN;

-- 1) barbecues.creator_id (text username) -> barbecues.creator_user_id (int FK users.id)
ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS creator_user_id integer;

UPDATE barbecues b
SET creator_user_id = u.id
FROM users u
WHERE b.creator_id IS NOT NULL
  AND u.username = b.creator_id;

-- Safety check: unresolved creator usernames become NULL.
UPDATE barbecues
SET creator_user_id = NULL
WHERE creator_id IS NOT NULL
  AND creator_user_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'barbecues_creator_user_id_fkey'
  ) THEN
    ALTER TABLE barbecues
      ADD CONSTRAINT barbecues_creator_user_id_fkey
      FOREIGN KEY (creator_user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE barbecues
  DROP COLUMN IF EXISTS creator_id;

-- 2) participants.user_id (text username) + invited_user_id (int) -> participants.user_id (int FK users.id)
ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS user_id_new integer;

-- Prefer invited_user_id when present, otherwise backfill from username.
UPDATE participants p
SET user_id_new = p.invited_user_id
WHERE p.invited_user_id IS NOT NULL;

UPDATE participants p
SET user_id_new = u.id
FROM users u
WHERE p.user_id_new IS NULL
  AND p.user_id IS NOT NULL
  AND u.username = p.user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participants_user_id_new_fkey'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_user_id_new_fkey
      FOREIGN KEY (user_id_new)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_barbecue_id_user_id_unique;
ALTER TABLE participants
  DROP CONSTRAINT IF EXISTS participants_unique_bbq_user;

ALTER TABLE participants
  DROP COLUMN IF EXISTS invited_user_id;
ALTER TABLE participants
  DROP COLUMN IF EXISTS user_id;
ALTER TABLE participants
  RENAME COLUMN user_id_new TO user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participants_user_id_fkey'
  ) THEN
    ALTER TABLE participants
      ADD CONSTRAINT participants_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE participants
  ADD CONSTRAINT participants_unique_bbq_user UNIQUE (barbecue_id, user_id);

-- 3) event_notifications.user_id (text username) -> event_notifications.user_id (int FK users.id)
ALTER TABLE event_notifications
  ADD COLUMN IF NOT EXISTS user_id_new integer;

UPDATE event_notifications n
SET user_id_new = u.id
FROM users u
WHERE n.user_id IS NOT NULL
  AND u.username = n.user_id;

-- Remove unresolved notification rows to satisfy NOT NULL + cascade FK contract.
DELETE FROM event_notifications
WHERE user_id IS NOT NULL
  AND user_id_new IS NULL;

ALTER TABLE event_notifications
  DROP COLUMN IF EXISTS user_id;
ALTER TABLE event_notifications
  RENAME COLUMN user_id_new TO user_id;

ALTER TABLE event_notifications
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_notifications_user_id_fkey'
  ) THEN
    ALTER TABLE event_notifications
      ADD CONSTRAINT event_notifications_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES users(id)
      ON DELETE CASCADE;
  END IF;
END $$;

COMMIT;
