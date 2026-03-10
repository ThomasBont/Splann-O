ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS resolution_mode text NOT NULL DEFAULT 'later';

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS excluded_from_final_settlement boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS settled_at timestamp;

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS linked_settlement_round_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'expenses_linked_settlement_round_id_fkey'
      AND table_name = 'expenses'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_linked_settlement_round_id_fkey
      FOREIGN KEY (linked_settlement_round_id)
      REFERENCES event_settlement_rounds(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE expenses
SET
  resolution_mode = COALESCE(NULLIF(trim(resolution_mode), ''), 'later'),
  excluded_from_final_settlement = CASE
    WHEN resolution_mode = 'now' THEN true
    ELSE excluded_from_final_settlement
  END
WHERE resolution_mode IS NULL
   OR trim(resolution_mode) = ''
   OR resolution_mode = 'now';
