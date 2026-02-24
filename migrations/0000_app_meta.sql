-- Schema version tracking. Run first. Idempotent.
-- Enables migration runner to skip already-applied migrations.

CREATE TABLE IF NOT EXISTS app_meta (
  id integer PRIMARY KEY DEFAULT 1,
  schema_version integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Ensure single row exists (id=1)
INSERT INTO app_meta (id, schema_version)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
