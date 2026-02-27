#!/usr/bin/env npx tsx
import "dotenv/config";

import { inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { barbecues } from "../shared/schema";

const SEED_TAGS = new Set(["dev-seed-v2", "nav-seed-v1"]);

function getDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function assertSafe() {
  const nodeEnv = process.env.NODE_ENV;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");
  const host = getDbHost(dbUrl);
  const allow = process.env.ALLOW_DB_RESET === "true";

  console.log("[db:reset:dev] host:", host);
  console.log("[db:reset:dev] NODE_ENV:", nodeEnv ?? "(unset)");
  if (!allow && nodeEnv !== "development") {
    throw new Error("Refusing to run outside development. Set ALLOW_DB_RESET=true to override.");
  }
  if (!allow && /render\.com|onrender/i.test(host)) {
    throw new Error("Refusing to run on Render-like host. Set ALLOW_DB_RESET=true to override.");
  }
}

async function main() {
  assertSafe();
  const dryRun = process.argv.includes("--dry-run");

  const rows = await db.select({ id: barbecues.id, templateData: barbecues.templateData }).from(barbecues);
  const seedIds = rows
    .filter((row) => {
      const tpl = row.templateData && typeof row.templateData === "object"
        ? (row.templateData as Record<string, unknown>)
        : null;
      return !!tpl && typeof tpl.__seedTag === "string" && SEED_TAGS.has(tpl.__seedTag);
    })
    .map((row) => row.id);

  console.log(`[db:reset:dev] found ${seedIds.length} seed events`);
  if (seedIds.length > 0) {
    console.log(`[db:reset:dev] event ids: ${seedIds.join(", ")}`);
  }

  if (!dryRun && seedIds.length > 0) {
    await db.delete(barbecues).where(inArray(barbecues.id, seedIds));
    console.log("[db:reset:dev] deleted seeded events (cascade applied)");
  } else if (dryRun) {
    console.log("[db:reset:dev] dry-run mode, no rows deleted");
  }
}

main()
  .catch((err) => {
    console.error("[db:reset:dev] failed:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });

