-- Identity-first creator settings / public profile fields

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS public_handle text,
  ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_event_type text NOT NULL DEFAULT 'private';

UPDATE users
SET public_handle = username
WHERE public_handle IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_public_handle_unique_idx
  ON users (public_handle)
  WHERE public_handle IS NOT NULL;
