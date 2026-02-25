-- Sprint E2: Stripe webhook idempotency table

CREATE TABLE IF NOT EXISTS stripe_events (
  id text PRIMARY KEY,
  created_at timestamp DEFAULT now()
);
