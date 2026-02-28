CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS event_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamp DEFAULT now(),
  CONSTRAINT event_members_event_user_unique UNIQUE (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  inviter_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  email text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  expires_at timestamp NOT NULL,
  accepted_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  accepted_at timestamp
);

-- Backfill owners as members (owner role) for existing events.
INSERT INTO event_members (event_id, user_id, role)
SELECT b.id, u.id, 'owner'
FROM barbecues b
JOIN users u ON u.username = b.creator_id
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Backfill accepted participants into event_members where possible.
INSERT INTO event_members (event_id, user_id, role)
SELECT p.barbecue_id, u.id, 'member'
FROM participants p
JOIN users u ON u.username = p.user_id
WHERE p.status = 'accepted'
ON CONFLICT (event_id, user_id) DO NOTHING;
