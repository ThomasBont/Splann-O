ALTER TABLE IF EXISTS event_settlement_rounds
  ADD COLUMN IF NOT EXISTS round_type text NOT NULL DEFAULT 'balance_settlement';

ALTER TABLE IF EXISTS event_settlement_rounds
  ADD COLUMN IF NOT EXISTS paid_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;

UPDATE event_settlement_rounds
SET round_type = 'balance_settlement'
WHERE round_type IS NULL OR trim(round_type) = '';
