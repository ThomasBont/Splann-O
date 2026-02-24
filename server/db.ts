import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Safe DB diagnostics (no secrets) — gate with DB_DEBUG=1
if (process.env.DB_DEBUG === "1") {
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("[db] connection:", {
      host: url.hostname,
      port: url.port,
      user: decodeURIComponent(url.username),
      db: url.pathname.slice(1) || "(default)",
    });
  } catch {
    console.log("[db] DB_DEBUG: could not parse DATABASE_URL");
  }
}

export const db = drizzle(pool, { schema });
