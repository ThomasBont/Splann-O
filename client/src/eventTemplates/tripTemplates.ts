import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  Car,
  Mountain,
  Music2,
  Briefcase,
  MoreHorizontal,
  Waves,
  Tent,
  Sunrise,
} from "lucide-react";
import type { EventTemplateTokens } from "./types";

export type TripTypeKey =
  | "city_trip"
  | "road_trip"
  | "beach_trip"
  | "ski_trip"
  | "festival_trip"
  | "hiking_trip"
  | "camping"
  | "weekend_getaway"
  | "business_trip"
  | "other_trip";

function t(
  bg: string,
  fg: string,
  card: string,
  cardFg: string,
  accent: string,
  accentFg: string,
  border?: string
): EventTemplateTokens & { border?: string } {
  return {
    background: bg,
    foreground: fg,
    card,
    cardForeground: cardFg,
    accent,
    accentForeground: accentFg,
    ...(border ? { border } : {}),
  };
}

export interface ExpenseTemplate {
  item: string;
  category: string;
  splitType?: "equal";
  notes?: string;
}

export interface TripTemplate {
  key: TripTypeKey;
  label: string;
  description: string;
  icon: LucideIcon;
  themeTokens: {
    light: EventTemplateTokens;
    dark: EventTemplateTokens;
  };
  hero: {
    title: string;
    subtitle: string;
    emoji?: string;
  };
  expenseTemplates: ExpenseTemplate[];
  /** Optional helper hint (e.g. "Track fuel costs per fill-up") */
  helper?: string;
}

const CITY_TRIP: TripTemplate = {
  key: "city_trip",
  label: "City Trip",
  description: "Explore urban destinations",
  icon: MapPin,
  themeTokens: {
    light: t("210 30% 98%", "210 25% 15%", "0 0% 100%", "210 25% 15%", "210 75% 45%", "0 0% 100%"),
    dark: t("210 25% 12%", "210 10% 92%", "210 22% 16%", "210 10% 92%", "210 75% 50%", "0 0% 100%"),
  },
  hero: { title: "City Trip", subtitle: "Maps, metros, and memories.", emoji: "🗺️" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Public transport pass", category: "Transport" },
    { item: "Meals & drinks", category: "Food" },
    { item: "Museum/attractions", category: "Tickets" },
  ],
};

const ROAD_TRIP: TripTemplate = {
  key: "road_trip",
  label: "Road Trip",
  description: "Hit the open road",
  icon: Car,
  themeTokens: {
    light: t("30 40% 97%", "28 25% 12%", "0 0% 100%", "28 25% 12%", "25 75% 52%", "0 0% 100%"),
    dark: t("28 25% 10%", "28 10% 92%", "28 20% 14%", "28 10% 92%", "25 80% 55%", "0 0% 100%"),
  },
  hero: { title: "Road Trip", subtitle: "Miles, memories, fair shares.", emoji: "🚗" },
  expenseTemplates: [
    { item: "Fuel", category: "Transport" },
    { item: "Tolls / parking", category: "Transport" },
    { item: "Car rental", category: "Transport" },
    { item: "Snacks", category: "Food" },
  ],
  helper: "Track fuel costs per fill-up for accurate splits.",
};

const BEACH_TRIP: TripTemplate = {
  key: "beach_trip",
  label: "Beach Trip",
  description: "Sun, sand, and smooth splits",
  icon: Waves,
  themeTokens: {
    light: t("195 40% 98%", "195 25% 15%", "0 0% 100%", "195 25% 15%", "190 75% 50%", "0 0% 100%"),
    dark: t("195 30% 12%", "195 10% 92%", "195 22% 16%", "195 10% 92%", "190 75% 55%", "0 0% 100%"),
  },
  hero: { title: "Beach Trip", subtitle: "Sun, sand, and smooth splits.", emoji: "🏖️" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Groceries", category: "Food" },
    { item: "Restaurants", category: "Food" },
    { item: "Beach activities", category: "Tickets" },
  ],
};

const SKI_TRIP: TripTemplate = {
  key: "ski_trip",
  label: "Ski Trip",
  description: "Hit the slopes",
  icon: Mountain,
  themeTokens: {
    light: t("200 40% 98%", "200 20% 15%", "0 0% 100%", "200 20% 15%", "200 70% 48%", "0 0% 100%"),
    dark: t("200 35% 12%", "200 10% 92%", "200 28% 16%", "200 10% 92%", "200 75% 52%", "0 0% 100%"),
  },
  hero: { title: "Ski Trip", subtitle: "Fresh powder, fair splits.", emoji: "⛷️" },
  expenseTemplates: [
    { item: "Ski pass", category: "Tickets" },
    { item: "Equipment rental", category: "Other" },
    { item: "Chalet / lodging", category: "Accommodation" },
    { item: "Après-ski", category: "Drinks" },
  ],
};

const FESTIVAL_TRIP: TripTemplate = {
  key: "festival_trip",
  label: "Festival Trip",
  description: "Music and memories",
  icon: Music2,
  themeTokens: {
    light: t("300 30% 98%", "300 25% 15%", "0 0% 100%", "300 25% 15%", "300 65% 55%", "0 0% 100%"),
    dark: t("300 25% 11%", "300 10% 92%", "300 22% 15%", "300 10% 92%", "300 70% 58%", "0 0% 100%"),
  },
  hero: { title: "Festival Trip", subtitle: "Split the vibe, keep the peace.", emoji: "🎪" },
  expenseTemplates: [
    { item: "Tickets", category: "Tickets" },
    { item: "Accommodation / camping", category: "Accommodation" },
    { item: "Drinks", category: "Drinks" },
    { item: "Transport", category: "Transport" },
  ],
};

const HIKING_TRIP: TripTemplate = {
  key: "hiking_trip",
  label: "Hiking Trip",
  description: "Trail, summit, fair splits",
  icon: Mountain,
  themeTokens: {
    light: t("142 35% 96%", "142 25% 12%", "0 0% 100%", "142 25% 12%", "142 55% 42%", "0 0% 100%"),
    dark: t("142 25% 11%", "142 10% 90%", "142 22% 16%", "142 10% 90%", "142 60% 48%", "0 0% 100%"),
  },
  hero: { title: "Hiking Trip", subtitle: "Trail, summit, fair splits.", emoji: "🥾" },
  expenseTemplates: [
    { item: "Trail pass", category: "Tickets" },
    { item: "Food", category: "Food" },
    { item: "Transport", category: "Transport" },
    { item: "Gear", category: "Other" },
  ],
};

const CAMPING: TripTemplate = {
  key: "camping",
  label: "Camping",
  description: "Under the stars, fair shares",
  icon: Tent,
  themeTokens: {
    light: t("85 30% 96%", "85 20% 15%", "0 0% 100%", "85 20% 15%", "85 50% 45%", "0 0% 100%"),
    dark: t("85 20% 11%", "85 10% 90%", "85 18% 15%", "85 10% 90%", "90 55% 48%", "0 0% 100%"),
  },
  hero: { title: "Camping", subtitle: "Under the stars, fair shares.", emoji: "⛺" },
  expenseTemplates: [
    { item: "Campsite", category: "Accommodation" },
    { item: "Groceries", category: "Food" },
    { item: "Equipment", category: "Other" },
    { item: "Firewood", category: "Other" },
  ],
};

const WEEKEND_GETAWAY: TripTemplate = {
  key: "weekend_getaway",
  label: "Weekend Getaway",
  description: "Quick escape, easy split",
  icon: Sunrise,
  themeTokens: {
    light: t("35 45% 98%", "35 25% 15%", "0 0% 100%", "35 25% 15%", "35 60% 55%", "0 0% 100%"),
    dark: t("35 30% 12%", "35 10% 92%", "35 22% 16%", "35 10% 92%", "40 65% 58%", "0 0% 100%"),
  },
  hero: { title: "Weekend Getaway", subtitle: "Quick escape, easy split.", emoji: "🌅" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Food", category: "Food" },
    { item: "Transport", category: "Transport" },
    { item: "Activities", category: "Tickets" },
  ],
};

const BUSINESS_TRIP: TripTemplate = {
  key: "business_trip",
  label: "Business Trip",
  description: "Professional splits made simple",
  icon: Briefcase,
  themeTokens: {
    light: t("220 25% 98%", "220 25% 12%", "0 0% 100%", "220 25% 12%", "220 65% 48%", "0 0% 100%"),
    dark: t("220 25% 10%", "220 10% 92%", "220 20% 14%", "220 10% 92%", "220 70% 52%", "0 0% 100%"),
  },
  hero: { title: "Business Trip", subtitle: "Professional splits made simple.", emoji: "💼" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Flights", category: "Transport" },
    { item: "Meals", category: "Food" },
    { item: "Transport", category: "Transport" },
  ],
};

const OTHER_TRIP: TripTemplate = {
  key: "other_trip",
  label: "Other",
  description: "Any other trip",
  icon: MoreHorizontal,
  themeTokens: {
    light: t("240 15% 97%", "240 20% 15%", "0 0% 100%", "240 20% 15%", "240 60% 50%", "0 0% 100%"),
    dark: t("240 20% 12%", "240 10% 92%", "240 18% 16%", "240 10% 92%", "240 65% 52%", "0 0% 100%"),
  },
  hero: { title: "Trip", subtitle: "Split costs, stay friends.", emoji: "✈️" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Food", category: "Food" },
    { item: "Transport", category: "Transport" },
    { item: "Other", category: "Other" },
  ],
};

/** Legacy event types -> fallback template. */
const LEGACY_TRIP_MAP: Record<string, TripTypeKey> = {
  vacation: "beach_trip",
  backpacking: "camping",
  bachelor_trip: "other_trip",
  workation: "business_trip",
};

export const tripTemplates: Record<TripTypeKey, TripTemplate> = {
  city_trip: CITY_TRIP,
  road_trip: ROAD_TRIP,
  beach_trip: BEACH_TRIP,
  ski_trip: SKI_TRIP,
  festival_trip: FESTIVAL_TRIP,
  hiking_trip: HIKING_TRIP,
  camping: CAMPING,
  weekend_getaway: WEEKEND_GETAWAY,
  business_trip: BUSINESS_TRIP,
  other_trip: OTHER_TRIP,
};

export const TRIP_TYPE_KEYS: TripTypeKey[] = [
  "city_trip",
  "road_trip",
  "beach_trip",
  "ski_trip",
  "festival_trip",
  "hiking_trip",
  "camping",
  "weekend_getaway",
  "business_trip",
  "other_trip",
];

const TRIP_KEYS_SET = new Set<string>(TRIP_TYPE_KEYS);

export function isTripEventType(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  if (TRIP_KEYS_SET.has(eventType)) return true;
  return eventType in LEGACY_TRIP_MAP;
}

export function getTripTemplate(key: string | null | undefined): TripTemplate {
  if (!key) return OTHER_TRIP;
  const resolved = (LEGACY_TRIP_MAP[key] ?? (TRIP_KEYS_SET.has(key) ? key : "other_trip")) as TripTypeKey;
  return tripTemplates[resolved] ?? OTHER_TRIP;
}
