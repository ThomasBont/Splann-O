ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

UPDATE expenses
SET created_by_user_id = COALESCE(created_by_user_id, (
  SELECT participants.user_id
  FROM participants
  WHERE participants.id = expenses.participant_id
))
WHERE created_by_user_id IS NULL;
