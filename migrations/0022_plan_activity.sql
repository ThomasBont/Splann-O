CREATE TABLE IF NOT EXISTS "plan_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_id" integer NOT NULL REFERENCES "barbecues"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "actor_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "actor_name" text,
  "message" text NOT NULL,
  "meta" json DEFAULT null,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "plan_activity_event_created_idx"
  ON "plan_activity" ("event_id", "created_at" DESC);
