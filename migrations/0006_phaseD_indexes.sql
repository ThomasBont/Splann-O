-- Phase D: Additional indexes for performance
-- event_notifications: lookup by user_id (frequent in getEventNotificationsForUser)

CREATE INDEX IF NOT EXISTS idx_event_notifications_user_id ON event_notifications(user_id);
