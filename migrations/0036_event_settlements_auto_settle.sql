ALTER TABLE barbecues
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 120;

CREATE TABLE IF NOT EXISTS event_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'proposed',
  source text NOT NULL DEFAULT 'auto',
  created_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_settlement_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES event_settlements(id) ON DELETE CASCADE,
  from_user_id integer NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  to_user_id integer NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  paid_at timestamptz,
  paid_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  payment_ref text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_settlement_transfers_settlement_idx
  ON event_settlement_transfers (settlement_id);

