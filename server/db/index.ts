/**
 * DB layer: pg Pool + Drizzle. Used by session store and repositories.
 * Security note: this is a direct Postgres connection (including when the
 * database is hosted on Supabase). Requests using this pool do NOT go through
 * Supabase Row Level Security. Normal app access must therefore be protected
 * by explicit backend auth + authorization checks in our Express routes.
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

let coreSchemaReadyPromise: Promise<void> | null = null;

async function repairCoreSchema(): Promise<void> {
  await pool.query(`
    ALTER TABLE barbecues
      ADD COLUMN IF NOT EXISTS start_date timestamp,
      ADD COLUMN IF NOT EXISTS end_date timestamp,
      ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now()
  `);
  await pool.query(`
    UPDATE barbecues
    SET
      start_date = COALESCE(start_date, date, updated_at, now()),
      end_date = COALESCE(end_date, date, updated_at, now()),
      created_at = COALESCE(created_at, updated_at, date, now())
    WHERE start_date IS NULL OR end_date IS NULL OR created_at IS NULL
  `);
  await pool.query(`
    ALTER TABLE barbecues
      ALTER COLUMN start_date SET DEFAULT now(),
      ALTER COLUMN end_date SET DEFAULT now(),
      ALTER COLUMN created_at SET DEFAULT now()
  `);
  await pool.query(`
    ALTER TABLE barbecues
      ALTER COLUMN start_date SET NOT NULL,
      ALTER COLUMN end_date SET NOT NULL
  `);
}

export function ensureCoreSchemaReady(): Promise<void> {
  if (!coreSchemaReadyPromise) {
    coreSchemaReadyPromise = repairCoreSchema().catch((error) => {
      coreSchemaReadyPromise = null;
      throw error;
    });
  }
  return coreSchemaReadyPromise;
}

if (process.env.DB_DEBUG === "1") {
  try {
    const url = new URL(databaseUrl);
    console.log("[db] connection:", {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      dbname: url.pathname.slice(1) || "(default)",
    });
  } catch {
    console.log("[db] DB_DEBUG: could not parse DATABASE_URL");
  }
}

export const db = drizzle(pool, { schema });
