/**
 * DB layer: pg Pool + Drizzle. Used by session store and repositories.
 */

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
