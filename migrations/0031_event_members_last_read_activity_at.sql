ALTER TABLE event_members
ADD COLUMN IF NOT EXISTS last_read_activity_at timestamp with time zone;
