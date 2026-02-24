import type { EventCategory } from "./eventThemes";
import { TRIP_THEMES, PARTY_THEMES, type ThemeToken, type TripType, type PartyType } from "./eventThemes";

const TRIP_KEYS = new Set<string>(Object.keys(TRIP_THEMES));
const PARTY_KEYS = new Set<string>(Object.keys(PARTY_THEMES));

/** Legacy event types map to fallback theme. */
const LEGACY_TRIP_MAP: Record<string, TripType> = {
  vacation: "beach_trip",
  backpacking: "camping",
  bachelor_trip: "other_trip",
  workation: "business_trip",
};

const LEGACY_PARTY_MAP: Record<string, PartyType> = {
  default: "other_party",
};

/**
 * Resolve theme for an event. Unknown types fall back to category-Other.
 */
export function getEventTheme(category: EventCategory, type: string | null | undefined): ThemeToken {
  const key = (type || "").trim();
  if (category === "trip") {
    const tripKey = (LEGACY_TRIP_MAP[key] ?? (TRIP_KEYS.has(key) ? key : "other_trip")) as TripType;
    return TRIP_THEMES[tripKey];
  }
  if (category === "party") {
    const partyKey = (LEGACY_PARTY_MAP[key] ?? (PARTY_KEYS.has(key) ? key : "other_party")) as PartyType;
    return PARTY_THEMES[partyKey];
  }
  return PARTY_THEMES.other_party;
}
