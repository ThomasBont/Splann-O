#!/usr/bin/env npx tsx
import "dotenv/config";

import { pool } from "../server/db";

type Args = {
  yes: boolean;
  withUsers: boolean;
  dryRun: boolean;
};

const EVENT_TABLES = [
  "public_event_messages",
  "public_event_conversations",
  "public_event_rsvps",
  "event_notifications",
  "expense_shares",
  "expenses",
  "notes",
  "participants",
  "barbecues",
] as const;

const USER_RELATED_TABLES = [
  "friendships",
  "password_reset_tokens",
  "session",
  "users",
] as const;

function parseArgs(argv: string[]): Args {
  return {
    yes: argv.includes("--yes"),
    withUsers: argv.includes("--with-users"),
    dryRun: argv.includes("--dry-run"),
  };
}

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set");
  return url;
}

function getDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function assertSafeToRun() {
  const nodeEnv = process.env.NODE_ENV;
  const allow = process.env.ALLOW_DB_RESET === "true";
  const dbUrl = getDbUrl();
  const host = getDbHost(dbUrl);
  const hostLooksProd = /render\.com|onrender/i.test(host);

  console.log("[db:reset] THIS WILL DELETE ALL EVENT DATA");
  console.log("[db:reset] DATABASE host:", host);
  console.log("[db:reset] NODE_ENV:", nodeEnv ?? "(unset)");
  console.log("[db:reset] ALLOW_DB_RESET:", allow ? "true" : "false");

  if (!allow && nodeEnv !== "development") {
    throw new Error("Refusing to run: NODE_ENV !== development. Set ALLOW_DB_RESET=true to override.");
  }
  if (hostLooksProd && !allow) {
    throw new Error("Refusing to run: DATABASE_URL looks like Render/production. Set ALLOW_DB_RESET=true to override.");
  }
}

async function countRows(table: string): Promise<number> {
  const res = await pool.query(`SELECT COUNT(*)::int AS count FROM "${table}"`);
  return Number(res.rows[0]?.count ?? 0);
}

async function collectCounts(tables: readonly string[]) {
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await countRows(table);
  }
  return counts;
}

async function truncateEventData() {
  await pool.query(`TRUNCATE TABLE "barbecues" RESTART IDENTITY CASCADE`);
}

async function truncateUsersToo() {
  // Event tables should already be gone; wipe remaining user-related tables.
  await pool.query(`TRUNCATE TABLE "friendships", "password_reset_tokens", "session", "users" RESTART IDENTITY CASCADE`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertSafeToRun();

  if (!args.yes) {
    console.error("[db:reset] Refusing to run without --yes");
    console.error("[db:reset] Re-run with: npx tsx script/db-reset.ts --yes");
    process.exit(1);
  }

  const tablesToReport = args.withUsers
    ? [...EVENT_TABLES, ...USER_RELATED_TABLES]
    : [...EVENT_TABLES];

  const before = await collectCounts(tablesToReport);

  console.log(`[db:reset] mode: ${args.dryRun ? "dry-run" : "execute"}`);
  if (args.withUsers) console.log("[db:reset] --with-users enabled (user accounts will be deleted)");

  if (!args.dryRun) {
    await truncateEventData();
    if (args.withUsers) await truncateUsersToo();
  }

  const after = args.dryRun ? before : await collectCounts(tablesToReport);

  console.log("[db:reset] Summary");
  for (const table of tablesToReport) {
    const deleted = before[table] - (after[table] ?? 0);
    console.log(`  ${table}: ${before[table]} -> ${after[table] ?? before[table]} (deleted ${deleted})`);
  }
}

main()
  .catch((err) => {
    console.error("[db:reset] Error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
