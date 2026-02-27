ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS event_vibe text NOT NULL DEFAULT 'cozy',
  ADD COLUMN IF NOT EXISTS location_text text,
  ADD COLUMN IF NOT EXISTS location_meta json;

UPDATE barbecues
SET location_text = COALESCE(location_text, location_name)
WHERE location_text IS NULL AND location_name IS NOT NULL;

UPDATE barbecues
SET event_vibe = CASE
  WHEN event_type IN ('city_trip', 'road_trip', 'beach_trip', 'ski_trip', 'festival_trip', 'hiking_trip', 'camping', 'weekend_getaway', 'vacation', 'backpacking', 'bachelor_trip', 'workation', 'business_trip', 'other_trip') THEN 'relaxed'
  WHEN event_type IN ('dinner_party') THEN 'casual'
  WHEN event_type IN ('game_night', 'movie_night', 'cinema', 'theme_park', 'day_out') THEN 'chill'
  WHEN event_type IN ('house_party', 'pool_party', 'after_party') THEN 'wild'
  WHEN event_type IN ('birthday', 'barbecue', 'other_party', 'default') THEN 'cozy'
  ELSE 'cozy'
END
WHERE event_vibe IS NULL OR event_vibe = '';
