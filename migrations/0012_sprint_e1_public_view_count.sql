-- Sprint E1: public event view analytics (phase 1.5)

ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS public_view_count integer NOT NULL DEFAULT 0;
