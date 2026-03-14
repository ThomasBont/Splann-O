CREATE TABLE IF NOT EXISTS event_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  uploaded_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key_original text NOT NULL,
  storage_key_thumb text,
  caption text,
  mime_type text NOT NULL,
  file_size integer NOT NULL,
  width integer,
  height integer,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS event_photos_event_created_idx
  ON event_photos(event_id, created_at);

CREATE INDEX IF NOT EXISTS event_photos_uploader_idx
  ON event_photos(uploaded_by_user_id, created_at);
