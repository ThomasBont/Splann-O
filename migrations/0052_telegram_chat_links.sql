CREATE TABLE IF NOT EXISTS telegram_chat_links (
  id serial PRIMARY KEY,
  telegram_chat_id text NOT NULL UNIQUE,
  plan_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
  connected_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_chat_links_plan_id_idx
  ON telegram_chat_links(plan_id);

