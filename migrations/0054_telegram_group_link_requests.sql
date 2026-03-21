CREATE TABLE IF NOT EXISTS telegram_group_link_requests (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  plan_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  requested_by_telegram_user_id text,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  consumed_by_chat_id text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_group_link_requests_plan_id_idx
  ON telegram_group_link_requests(plan_id);

CREATE INDEX IF NOT EXISTS telegram_group_link_requests_expires_at_idx
  ON telegram_group_link_requests(expires_at);
