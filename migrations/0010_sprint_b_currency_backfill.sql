-- Sprint B: Backfill currency_source for existing events (no location = manual currency)
-- Events created before location feature had user-selected currency

UPDATE barbecues
SET currency_source = 'manual'
WHERE country_code IS NULL
  AND (currency_source IS NULL OR currency_source = 'auto');
