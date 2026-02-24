-- Create notes table for event notes
-- Use this if db:push did not create the table (e.g. "relation \"notes\" does not exist")
-- Run: psql $DATABASE_URL -f migrations/0002_add_notes_table.sql
-- Or: npm run db:push (preferred, syncs full schema)

CREATE TABLE IF NOT EXISTS notes (
  id serial PRIMARY KEY,
  barbecue_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  participant_id integer NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  title text,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
