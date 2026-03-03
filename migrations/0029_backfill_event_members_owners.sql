-- Backfill missing event_members rows for owners and accepted participants.
-- Safe to re-run: uses ON CONFLICT (event_id, user_id) DO NOTHING.

-- Backfill creators as owners.
INSERT INTO event_members (event_id, user_id, role, joined_at)
SELECT b.id, b.creator_user_id, 'owner', COALESCE(b.updated_at, now())
FROM barbecues b
WHERE b.creator_user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;

-- Backfill accepted participants as members.
INSERT INTO event_members (event_id, user_id, role, joined_at)
SELECT p.barbecue_id, p.user_id, 'member', COALESCE(p.created_at, now())
FROM participants p
WHERE p.status = 'accepted'
  AND p.user_id IS NOT NULL
ON CONFLICT (event_id, user_id) DO NOTHING;
