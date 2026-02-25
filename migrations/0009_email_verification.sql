-- Email verification for users

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_verify_token text,
  ADD COLUMN IF NOT EXISTS email_verify_token_expires_at timestamptz;
