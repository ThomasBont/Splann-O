#!/usr/bin/env npx tsx
import "dotenv/config";

import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { barbecues, type Barbecue } from "../shared/schema";
import { isPrivateEvent } from "../shared/event-visibility";

const dryRun = process.argv.includes("--dry-run");

function hasPublicIntentEvidence(event: Barbecue): boolean {
  if (event.visibility === "public") return true;
  if (event.publicSlug) return true;
  if ((event.status as string | undefined) === "draft") return true;
  if (event.organizationName || event.publicDescription || event.bannerImageUrl) return true;
  if ((event.publicTemplate as string | undefined) && event.publicTemplate !== "classic") return true;
  const tpl = event.templateData && typeof event.templateData === "object" ? (event.templateData as Record<string, unknown>) : null;
  return !!(tpl && (tpl.publicCategory || tpl.publicRsvpTiers || tpl.publicCapacity || tpl.publicExternalLink));
}

function normalizedPrivatePatch(event: Barbecue): Partial<Barbecue> {
  const patch: Partial<Barbecue> = {};
  if (event.visibility !== "private") patch.visibility = "private";
  if ((event.visibilityOrigin as string | undefined) !== "private") patch.visibilityOrigin = "private";
  if (event.isPublic !== false) patch.isPublic = false;
  if (event.publicMode !== "marketing") patch.publicMode = "marketing";
  if (event.publicTemplate !== "classic") patch.publicTemplate = "classic";
  if (event.publicListingStatus !== "inactive") patch.publicListingStatus = "inactive";
  if (event.publicListFromAt !== null) patch.publicListFromAt = null;
  if (event.publicListUntilAt !== null) patch.publicListUntilAt = null;
  if (event.publicListingExpiresAt !== null) patch.publicListingExpiresAt = null;
  if (event.publicSlug !== null) patch.publicSlug = null;
  if (event.organizationName !== null) patch.organizationName = null;
  if (event.publicDescription !== null) patch.publicDescription = null;
  if (event.bannerImageUrl !== null) patch.bannerImageUrl = null;
  return patch;
}

function changedFields(patch: Partial<Barbecue>): string[] {
  return Object.keys(patch);
}

async function main() {
  const rows = await db.select().from(barbecues);
  const repaired: Array<{ id: number; reason: string; fields: string[] }> = [];
  const suspiciousOnly: Array<{ id: number; reason: string }> = [];

  for (const event of rows) {
    const canonicalPrivate = isPrivateEvent(event);
    const suspiciousOriginPollution =
      event.visibility !== "public" &&
      (event.visibilityOrigin as string | undefined) === "public" &&
      !hasPublicIntentEvidence(event);

    if (!canonicalPrivate && !suspiciousOriginPollution) continue;

    const patch = normalizedPrivatePatch(event);
    const fields = changedFields(patch);
    if (fields.length === 0) continue;

    repaired.push({
      id: event.id,
      reason: suspiciousOriginPollution ? "heuristic_visibility_origin_repair" : "private_public_fields_cleanup",
      fields,
    });

    if (!dryRun) {
      await db.update(barbecues).set({ ...patch, updatedAt: new Date() }).where(eq(barbecues.id, event.id));
    }
  }

  for (const event of rows) {
    if (
      event.visibility !== "public" &&
      (event.visibilityOrigin as string | undefined) === "public" &&
      !hasPublicIntentEvidence(event)
    ) {
      if (!repaired.some((r) => r.id === event.id)) {
        suspiciousOnly.push({ id: event.id, reason: "suspicious_origin_public_no_public_evidence" });
      }
    }
  }

  console.log(`[repair-private-events] mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`[repair-private-events] scanned: ${rows.length}`);
  console.log(`[repair-private-events] repaired: ${repaired.length}`);
  if (repaired.length > 0) {
    for (const row of repaired) {
      console.log(`  - event ${row.id}: ${row.reason} -> ${row.fields.join(", ")}`);
    }
  }
  if (suspiciousOnly.length > 0) {
    console.log(`[repair-private-events] suspicious (not changed): ${suspiciousOnly.length}`);
    for (const row of suspiciousOnly) {
      console.log(`  - event ${row.id}: ${row.reason}`);
    }
  }
}

main().catch((err) => {
  console.error("[repair-private-events] failed", err);
  process.exit(1);
});

