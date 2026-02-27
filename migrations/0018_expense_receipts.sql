ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_mime text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp;

