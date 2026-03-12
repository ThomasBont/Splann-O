ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS push_preferences JSONB NOT NULL
DEFAULT '{"chatMessages":true,"expenses":true,"paymentRequests":true,"planInvites":true}'::jsonb;
