ALTER TABLE "barbecues"
  ADD COLUMN IF NOT EXISTS "local_date" text,
  ADD COLUMN IF NOT EXISTS "local_time" text,
  ADD COLUMN IF NOT EXISTS "timezone_id" text;

