-- Soft-hide historical duplicate expense system chat rows.
-- Keeps the earliest row per (event, expenseId, action) and hides subsequent rows posted within 5 seconds.

ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz NULL;

WITH expense_system_rows AS (
  SELECT
    m.id,
    m.event_id,
    m.created_at,
    m.metadata->>'expenseId' AS expense_id,
    m.metadata->>'action' AS action
  FROM event_chat_messages m
  WHERE m.type = 'system'
    AND m.hidden_at IS NULL
    AND m.metadata IS NOT NULL
    AND m.metadata->>'type' = 'expense'
    AND NULLIF(m.metadata->>'expenseId', '') IS NOT NULL
    AND NULLIF(m.metadata->>'action', '') IS NOT NULL
),
ordered AS (
  SELECT
    r.id,
    r.event_id,
    r.created_at,
    r.expense_id,
    r.action,
    LAG(r.created_at) OVER (
      PARTITION BY r.event_id, r.expense_id, r.action
      ORDER BY r.created_at, r.id
    ) AS prev_created_at
  FROM expense_system_rows r
),
duplicates AS (
  SELECT o.id
  FROM ordered o
  WHERE o.prev_created_at IS NOT NULL
    AND o.created_at <= o.prev_created_at + interval '5 seconds'
)
UPDATE event_chat_messages m
SET hidden_at = NOW()
FROM duplicates d
WHERE m.id = d.id
  AND m.hidden_at IS NULL;

