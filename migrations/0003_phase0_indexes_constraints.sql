-- Phase 0: Safe indexes and constraints (refactor roadmap)
-- Run: psql $DATABASE_URL -f migrations/0003_phase0_indexes_constraints.sql
-- Safe to run multiple times (IF NOT EXISTS / DO blocks)

-- 1. Add createdAt to expenses (audit)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

-- 2. Add updatedAt to barbecues (audit)
ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

-- 3. Indexes for frequent queries
CREATE INDEX IF NOT EXISTS idx_participants_barbecue_id ON participants(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_expenses_barbecue_id ON expenses(barbecue_id);
CREATE INDEX IF NOT EXISTS idx_expenses_participant_id ON expenses(participant_id);
CREATE INDEX IF NOT EXISTS idx_barbecues_creator_id ON barbecues(creator_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester_id ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires ON password_reset_tokens(user_id, expires_at);

-- 4. Friendships: prevent duplicate (requester, addressee) pairs
-- Use unique index; nulls not an issue since both are NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_requester_addressee_unique
  ON friendships(requester_id, addressee_id);

-- 5. Friendships: prevent self-friending (check constraint)
-- Remove any existing self-friend rows before adding constraint
DELETE FROM friendships WHERE requester_id = addressee_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friendships_no_self_friend'
  ) THEN
    ALTER TABLE friendships
      ADD CONSTRAINT friendships_no_self_friend CHECK (requester_id != addressee_id);
  END IF;
END $$;
