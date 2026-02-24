-- Phase 1: invitedUserId for robust private invites
-- participants.invited_user_id: FK to users.id, set when inviting a user; status 'invited'|'accepted'

ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS invited_user_id integer REFERENCES users(id) ON DELETE SET NULL;

-- Indexes for participant lookups
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_invited_user_id ON participants(invited_user_id);
