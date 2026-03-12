CREATE TABLE push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  push_preferences JSONB NOT NULL DEFAULT '{"chatMessages":true,"expenses":true,"paymentRequests":true,"planInvites":true}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);
