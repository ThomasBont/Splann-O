ALTER TABLE telegram_chat_links
  ADD COLUMN IF NOT EXISTS telegram_chat_title text,
  ADD COLUMN IF NOT EXISTS telegram_chat_type text,
  ADD COLUMN IF NOT EXISTS linked_at timestamp DEFAULT now();

UPDATE telegram_chat_links
SET linked_at = COALESCE(linked_at, created_at, now())
WHERE linked_at IS NULL;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY plan_id
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM telegram_chat_links
)
DELETE FROM telegram_chat_links
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS telegram_chat_links_plan_id_unique_idx
  ON telegram_chat_links(plan_id);
