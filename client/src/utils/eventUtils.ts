/**
 * Event normalization and type safety.
 * Maps raw DB shape (area, eventType) to canonical category + type.
 * Backward compatible: missing/legacy values infer correct defaults.
 */

import type { EventCategory, TripType, PartyType } from "@/theme/eventThemes";
import { TRIP_THEME_KEYS, PARTY_THEME_KEYS } from "@/theme/eventThemes";

const TRIP_SET = new Set<string>(TRIP_THEME_KEYS);
const PARTY_SET = new Set<string>(PARTY_THEME_KEYS);

/** Legacy event_type values -> canonical type. */
const LEGACY_TO_TRIP: Record<string, TripType> = {
  vacation: "beach_trip",
  backpacking: "camping",
  bachelor_trip: "other_trip",
  workation: "business_trip",
};

const LEGACY_TO_PARTY: Record<string, PartyType> = {
  default: "other_party",
};

export type NormalizedEventCategory = EventCategory;
export type NormalizedEventType = TripType | PartyType;

export interface NormalizedEventMeta {
  category: NormalizedEventCategory;
  type: NormalizedEventType;
}

/**
 * Normalize raw event from API/DB to canonical category + type.
 * - If category (area) missing: infer from type (trip types -> trip, else party).
 * - If type unknown or legacy: map to category-appropriate "Other".
 * - DB uses "area" (parties|trips), we expose "category" (party|trip).
 */
export function normalizeEvent(raw: {
  area?: string | null;
  eventType?: string | null;
  [key: string]: unknown;
}): NormalizedEventMeta {
  const rawArea = (raw.area ?? "").trim().toLowerCase();
  const rawType = (raw.eventType ?? "").trim();

  // Infer category from area or from type
  let category: NormalizedEventCategory;
  if (rawArea === "trips") {
    category = "trip";
  } else if (rawArea === "parties") {
    category = "party";
  } else if (TRIP_SET.has(rawType) || rawType in LEGACY_TO_TRIP) {
    category = "trip";
  } else {
    category = "party";
  }

  // Resolve type with legacy mapping and unknown fallback
  let type: NormalizedEventType;
  if (category === "trip") {
    const resolved = LEGACY_TO_TRIP[rawType] ?? (TRIP_SET.has(rawType) ? rawType : "other_trip");
    type = resolved as TripType;
  } else {
    const resolved = LEGACY_TO_PARTY[rawType] ?? (PARTY_SET.has(rawType) ? rawType : "other_party");
    type = resolved as PartyType;
  }

  return { category, type };
}

/** Get category from raw event (for DB write: "party" -> "parties", "trip" -> "trips"). */
export function categoryToArea(category: NormalizedEventCategory): "parties" | "trips" {
  return category === "trip" ? "trips" : "parties";
}

/** Get area from raw event. When missing, infers from type (backward compat). */
export function getEventArea(raw: { area?: string | null; eventType?: string | null }): "parties" | "trips" {
  const a = (raw.area ?? "").trim().toLowerCase();
  if (a === "trips") return "trips";
  if (a === "parties") return "parties";
  const { category } = normalizeEvent(raw);
  return categoryToArea(category);
}
