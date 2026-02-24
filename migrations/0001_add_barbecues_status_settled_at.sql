-- Add status and settled_at columns to barbecues (fixes: column "status" of relation "barbecues" does not exist)
-- Run with: psql $DATABASE_URL -f migrations/0001_add_barbecues_status_settled_at.sql

-- Add status column (draft | active | settling | settled)
ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Add settled_at column (when creator triggered settle-up)
ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS settled_at timestamp;
