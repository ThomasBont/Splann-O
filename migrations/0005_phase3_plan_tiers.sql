-- Phase 3: Plan/tier columns for future monetization
-- Run: psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql
-- Required before deploy to fix "column plan does not exist" on login.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_expires_at timestamp;
