-- Trip location + currency source. Trips: locationName, city, countryCode for auto-currency.
-- Users: default_currency_code for fallback when country mapping unknown.

ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS location_name text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS country_name text,
  ADD COLUMN IF NOT EXISTS place_id text,
  ADD COLUMN IF NOT EXISTS currency_source text NOT NULL DEFAULT 'auto';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_currency_code text;
