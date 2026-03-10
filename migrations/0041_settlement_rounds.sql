ALTER TABLE IF EXISTS event_settlements
  RENAME TO event_settlement_rounds;

ALTER TABLE IF EXISTS event_settlement_rounds
  RENAME COLUMN settled_at TO completed_at;

ALTER TABLE IF EXISTS event_settlement_rounds
  ADD COLUMN IF NOT EXISTS title text;

UPDATE event_settlement_rounds
SET title = COALESCE(NULLIF(title, ''), 'Settlement round')
WHERE title IS NULL OR title = '';

UPDATE event_settlement_rounds
SET status = CASE
  WHEN status = 'settled' THEN 'completed'
  WHEN status IN ('proposed', 'in_progress') THEN 'active'
  ELSE status
END;

ALTER TABLE IF EXISTS event_settlement_rounds
  ALTER COLUMN title SET NOT NULL;

ALTER TABLE IF EXISTS event_settlement_rounds
  DROP COLUMN IF EXISTS source;

ALTER TABLE IF EXISTS event_settlement_rounds
  DROP COLUMN IF EXISTS idempotency_key;

ALTER TABLE IF EXISTS event_settlement_transfers
  RENAME COLUMN settlement_id TO settlement_round_id;

ALTER INDEX IF EXISTS event_settlement_transfers_settlement_idx
  RENAME TO event_settlement_transfers_settlement_round_idx;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'event_settlement_rounds_one_active_per_event_idx'
  ) THEN
    CREATE UNIQUE INDEX event_settlement_rounds_one_active_per_event_idx
      ON event_settlement_rounds (event_id)
      WHERE status = 'active';
  END IF;
END $$;
