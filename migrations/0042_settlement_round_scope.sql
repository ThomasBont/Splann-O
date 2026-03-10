ALTER TABLE IF EXISTS event_settlement_rounds
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'everyone';

ALTER TABLE IF EXISTS event_settlement_rounds
  ADD COLUMN IF NOT EXISTS selected_participant_ids json;

UPDATE event_settlement_rounds
SET selected_participant_ids = NULL
WHERE selected_participant_ids IS NOT NULL
  AND scope_type = 'everyone';
