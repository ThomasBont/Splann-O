-- Sprint E Phase 1: public events platform fields + listing gate metadata

ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS public_mode text NOT NULL DEFAULT 'marketing',
  ADD COLUMN IF NOT EXISTS public_listing_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS public_listing_expires_at timestamp,
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS organization_name text,
  ADD COLUMN IF NOT EXISTS public_description text,
  ADD COLUMN IF NOT EXISTS banner_image_url text;

CREATE UNIQUE INDEX IF NOT EXISTS barbecues_public_slug_unique_idx
  ON barbecues (public_slug)
  WHERE public_slug IS NOT NULL;
