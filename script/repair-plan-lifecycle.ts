#!/usr/bin/env npx tsx
import "dotenv/config";

import { db } from "../server/db";
import { barbecues } from "../shared/schema";
import { refreshPlanLifecycles } from "../server/lib/planLifecycle";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const rows = await db.select().from(barbecues);
  const before = new Map(rows.map((row) => [row.id, { status: row.status, settledAt: row.settledAt }]));

  if (!dryRun) {
    await refreshPlanLifecycles(rows.map((row) => row.id));
  }

  const afterRows = dryRun ? rows : await db.select().from(barbecues);
  const changed = afterRows
    .map((row) => {
      const previous = before.get(row.id);
      if (!previous) return null;
      const settledAtChanged = (previous.settledAt?.getTime?.() ?? null) !== (row.settledAt?.getTime?.() ?? null);
      if (previous.status === row.status && !settledAtChanged) return null;
      return {
        id: row.id,
        fromStatus: previous.status,
        toStatus: row.status,
        fromSettledAt: previous.settledAt?.toISOString?.() ?? null,
        toSettledAt: row.settledAt?.toISOString?.() ?? null,
      };
    })
    .filter((value): value is NonNullable<typeof value> => !!value);

  console.log(`[repair-plan-lifecycle] mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`[repair-plan-lifecycle] scanned: ${rows.length}`);
  console.log(`[repair-plan-lifecycle] changed: ${changed.length}`);
  for (const row of changed) {
    console.log(
      `  - event ${row.id}: ${row.fromStatus} -> ${row.toStatus}`
      + (row.fromSettledAt !== row.toSettledAt ? ` | settledAt: ${row.fromSettledAt ?? "null"} -> ${row.toSettledAt ?? "null"}` : ""),
    );
  }
}

main().catch((error) => {
  console.error("[repair-plan-lifecycle] failed", error);
  process.exit(1);
});
