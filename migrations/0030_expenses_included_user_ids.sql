ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS included_user_ids text[];
