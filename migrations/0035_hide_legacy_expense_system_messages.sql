-- Soft-hide old plain-text expense system chat rows introduced before structured metadata cards.
-- No data is deleted; rows remain in DB but are hidden from default reads.

ALTER TABLE event_chat_messages
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz NULL;

UPDATE event_chat_messages
SET hidden_at = NOW()
WHERE hidden_at IS NULL
  AND type = 'system'
  AND (metadata IS NULL OR COALESCE(metadata->>'type', '') <> 'expense')
  AND (
    content ILIKE '% added an expense:%'
    OR content ILIKE '% updated an expense:%'
    OR content ILIKE '% deleted an expense:%'
  )
  AND content ~* '\([^)]*(€|EUR|USD|GBP|CAD|AUD|CHF|SEK|NOK|DKK|JPY)[^)]*\d[^)]*\)';

