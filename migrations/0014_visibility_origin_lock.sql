ALTER TABLE barbecues
ADD COLUMN IF NOT EXISTS visibility_origin text NOT NULL DEFAULT 'public';

UPDATE barbecues
SET visibility_origin = CASE
  WHEN visibility = 'public' THEN 'public'
  ELSE 'public'
END
WHERE visibility_origin IS NULL;
