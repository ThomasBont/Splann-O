#!/usr/bin/env npx tsx
/**
 * Migration runner: applies migrations in ./migrations in order.
 * Updates app_meta.schema_version after each migration.
 *
 * Usage:
 *   npm run db:migrate   # apply all pending migrations
 *   npm run db:check     # print schema version + connectivity
 *
 * Uses DATABASE_URL from env. For Supabase pooler, quote if password has !:
 *   DATABASE_URL='postgres://...' npm run db:migrate
 */

import "dotenv/config";

import pg from "pg";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const { Pool } = pg;

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL must be set");
    process.exit(1);
  }
  return url;
}

function createPool(): pg.Pool {
  return new Pool({
    connectionString: getDbUrl(),
    ssl: { rejectUnauthorized: false },
  });
}

/** Extract version number from filename, e.g. 0003_foo.sql -> 3 */
function versionFromFilename(name: string): number | null {
  const match = name.match(/^(\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

async function getSchemaVersion(pool: pg.Pool): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_meta (
        id integer PRIMARY KEY DEFAULT 1,
        schema_version integer NOT NULL DEFAULT 0,
        updated_at timestamptz DEFAULT now()
      )
    `);
    await client.query(`
      INSERT INTO app_meta (id, schema_version) VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING
    `);
    const res = await client.query("SELECT schema_version FROM app_meta WHERE id = 1");
    return res.rows[0]?.schema_version ?? 0;
  } finally {
    client.release();
  }
}

async function setSchemaVersion(pool: pg.Pool, version: number): Promise<void> {
  const client = await pool.connect();
  try {
    // Avoid prepared statements (Supabase pooler); version is integer-safe
    await client.query(
      `UPDATE app_meta SET schema_version = ${version}, updated_at = now() WHERE id = 1`
    );
  } finally {
    client.release();
  }
}

async function runMigration(pool: pg.Pool, sql: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

async function migrate(): Promise<void> {
  const pool = createPool();

  try {
    const current = await getSchemaVersion(pool);
    console.log(`[db:migrate] Current schema version: ${current}`);

    const files = await readdir(MIGRATIONS_DIR);
    const migrations = files
      .filter((f) => f.endsWith(".sql"))
      .map((f) => ({ name: f, version: versionFromFilename(f) }))
      .filter((m): m is { name: string; version: number } => m.version !== null)
      .sort((a, b) => a.version - b.version);

    const duplicates = new Map<number, string[]>();
    for (const migration of migrations) {
      const current = duplicates.get(migration.version) ?? [];
      current.push(migration.name);
      duplicates.set(migration.version, current);
    }
    const duplicateEntries = Array.from(duplicates.entries()).filter(([, names]) => names.length > 1);
    if (duplicateEntries.length > 0) {
      console.warn("[db:migrate] Duplicate migration versions detected:");
      for (const [version, names] of duplicateEntries) {
        console.warn(`  v${version}: ${names.join(", ")}`);
      }
    }

    let applied = 0;
    for (const { name, version } of migrations) {
      if (version <= current) continue;

      const path = join(MIGRATIONS_DIR, name);
      const sql = await readFile(path, "utf-8");
      console.log(`[db:migrate] Applying ${name} (→ v${version})`);
      await runMigration(pool, sql);
      await setSchemaVersion(pool, version);
      applied++;
    }

    const final = await getSchemaVersion(pool);
    console.log(`[db:migrate] Done. Schema version: ${final} (${applied} applied)`);
  } finally {
    await pool.end();
  }
}

async function check(): Promise<void> {
  const pool = createPool();

  try {
    const version = await getSchemaVersion(pool);
    const url = getDbUrl();
    let parsed: { host: string; port: string; user: string; database: string } | null = null;
    try {
      const u = new URL(url);
      parsed = {
        host: u.hostname,
        port: u.port || "5432",
        user: decodeURIComponent(u.username),
        database: u.pathname.slice(1) || "postgres",
      };
    } catch {
      // ignore
    }

    console.log("[db:check] OK");
    console.log(`  schema_version: ${version}`);
    if (parsed) {
      console.log(`  host: ${parsed.host}`);
      console.log(`  port: ${parsed.port}`);
      console.log(`  user: ${parsed.user}`);
      console.log(`  database: ${parsed.database}`);
    }
  } finally {
    await pool.end();
  }
}

const cmd = process.argv[2] || "migrate";
if (cmd === "check") {
  check().catch((err) => {
    console.error("[db:check] Error:", err.message);
    process.exit(1);
  });
} else if (cmd === "migrate") {
  migrate().catch((err) => {
    console.error("[db:migrate] Error:", err.message);
    process.exit(1);
  });
} else {
  console.error("Usage: npx tsx script/db-migrate.ts [check|migrate]");
  process.exit(1);
}
