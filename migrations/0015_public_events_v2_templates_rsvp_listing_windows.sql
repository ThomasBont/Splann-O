-- Public Events v2: templates, listing windows, lightweight RSVP records

ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS public_template text NOT NULL DEFAULT 'classic',
  ADD COLUMN IF NOT EXISTS public_list_from_at timestamp,
  ADD COLUMN IF NOT EXISTS public_list_until_at timestamp;

ALTER TABLE barbecues
  ALTER COLUMN public_listing_status SET DEFAULT 'inactive';

CREATE TABLE IF NOT EXISTS public_event_rsvps (
  id serial PRIMARY KEY,
  barbecue_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  tier_id text,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  email text,
  name text,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_event_rsvps_event_user_tier_idx
  ON public_event_rsvps (barbecue_id, user_id, tier_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS public_event_rsvps_event_idx
  ON public_event_rsvps (barbecue_id);
