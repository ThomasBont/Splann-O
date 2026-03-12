ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS start_date timestamp,
  ADD COLUMN IF NOT EXISTS end_date timestamp,
  ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();

UPDATE barbecues
SET
  start_date = COALESCE(start_date, date, updated_at, now()),
  end_date = COALESCE(end_date, date, updated_at, now()),
  created_at = COALESCE(created_at, updated_at, date, now());

ALTER TABLE barbecues
  ALTER COLUMN start_date SET NOT NULL,
  ALTER COLUMN end_date SET NOT NULL;

ALTER TABLE barbecues
  ALTER COLUMN start_date SET DEFAULT now(),
  ALTER COLUMN end_date SET DEFAULT now(),
  ALTER COLUMN created_at SET DEFAULT now();
