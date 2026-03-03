ALTER TABLE participants
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY barbecue_id, user_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM participants
  WHERE user_id IS NOT NULL
)
DELETE FROM participants
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS participants_barbecue_user_unique
  ON participants (barbecue_id, user_id);
