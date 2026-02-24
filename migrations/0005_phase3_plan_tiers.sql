-- Phase 3: Plan/tier columns for future monetization
-- Run: psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan text DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamp;
