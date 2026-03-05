ALTER TABLE event_settlements
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

-- Backfill historical settled rows
UPDATE event_settlements
SET settled_at = COALESCE(settled_at, created_at, NOW())
WHERE status = 'settled' AND settled_at IS NULL;
