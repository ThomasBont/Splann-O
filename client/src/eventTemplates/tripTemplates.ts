import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  Palette,
  Car,
  Backpack,
  Mountain,
  Music2,
  Crown,
  Briefcase,
  MoreHorizontal,
} from "lucide-react";
import type { EventTemplateTokens } from "./types";

export type TripTypeKey =
  | "city_trip"
  | "vacation"
  | "road_trip"
  | "backpacking"
  | "ski_trip"
  | "festival_trip"
  | "bachelor_trip"
  | "workation"
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

const VACATION: TripTemplate = {
  key: "vacation",
  label: "Vacation",
  description: "Relax and recharge",
  icon: Palette,
  themeTokens: {
    light: t("35 55% 97%", "30 25% 15%", "0 0% 100%", "30 25% 15%", "35 75% 55%", "0 0% 100%"),
    dark: t("35 30% 12%", "35 10% 92%", "35 22% 16%", "35 10% 92%", "35 75% 58%", "0 0% 100%"),
  },
  hero: { title: "Vacation", subtitle: "Sun, sand, and smooth splits.", emoji: "🏖️" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Groceries", category: "Food" },
    { item: "Restaurants", category: "Food" },
    { item: "Beach activities", category: "Tickets" },
  ],
};

const ROAD_TRIP: TripTemplate = {
  key: "road_trip",
  label: "Road Trip",
  description: "Hit the open road",
  icon: Car,
  themeTokens: {
    light: t("220 20% 95%", "220 25% 12%", "220 15% 98%", "220 25% 12%", "220 60% 42%", "0 0% 100%"),
    dark: t("220 25% 10%", "220 10% 92%", "220 20% 14%", "220 10% 92%", "220 65% 48%", "0 0% 100%"),
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

const BACKPACKING: TripTemplate = {
  key: "backpacking",
  label: "Backpacking",
  description: "Adventure on a budget",
  icon: Backpack,
  themeTokens: {
    light: t("85 25% 96%", "85 20% 15%", "0 0% 100%", "85 20% 15%", "85 45% 42%", "0 0% 100%"),
    dark: t("85 20% 11%", "85 10% 90%", "85 18% 15%", "85 10% 90%", "85 50% 45%", "0 0% 100%"),
  },
  hero: { title: "Backpacking", subtitle: "Light loads, fair shares.", emoji: "🎒" },
  expenseTemplates: [
    { item: "Hostels", category: "Accommodation" },
    { item: "Local transport", category: "Transport" },
    { item: "SIM / data", category: "Other" },
    { item: "Group meals", category: "Food" },
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

const BACHELOR_TRIP: TripTemplate = {
  key: "bachelor_trip",
  label: "Bachelor Trip",
  description: "One last celebration",
  icon: Crown,
  themeTokens: {
    light: t("45 40% 98%", "280 20% 15%", "0 0% 100%", "280 20% 15%", "45 85% 55%", "280 20% 10%"),
    dark: t("280 25% 11%", "45 10% 95%", "280 22% 15%", "45 10% 95%", "45 80% 58%", "280 20% 10%"),
  },
  hero: { title: "Bachelor Trip", subtitle: "Celebrate big, split fair.", emoji: "👑" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Activities", category: "Tickets" },
    { item: "Drinks", category: "Drinks" },
    { item: "Decorations / surprises", category: "Other" },
  ],
};

const WORKATION: TripTemplate = {
  key: "workation",
  label: "Workation",
  description: "Work remotely, travel freely",
  icon: Briefcase,
  themeTokens: {
    light: t("175 35% 98%", "175 25% 12%", "0 0% 100%", "175 25% 12%", "175 55% 45%", "0 0% 100%"),
    dark: t("175 30% 11%", "175 10% 92%", "175 22% 15%", "175 10% 92%", "175 60% 50%", "0 0% 100%"),
  },
  hero: { title: "Workation", subtitle: "Productive and balanced.", emoji: "💼" },
  expenseTemplates: [
    { item: "Accommodation", category: "Accommodation" },
    { item: "Coworking", category: "Other" },
    { item: "Groceries", category: "Food" },
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

export const tripTemplates: Record<TripTypeKey, TripTemplate> = {
  city_trip: CITY_TRIP,
  vacation: VACATION,
  road_trip: ROAD_TRIP,
  backpacking: BACKPACKING,
  ski_trip: SKI_TRIP,
  festival_trip: FESTIVAL_TRIP,
  bachelor_trip: BACHELOR_TRIP,
  workation: WORKATION,
  other_trip: OTHER_TRIP,
};

export const TRIP_TYPE_KEYS: TripTypeKey[] = [
  "city_trip",
  "vacation",
  "road_trip",
  "backpacking",
  "ski_trip",
  "festival_trip",
  "bachelor_trip",
  "workation",
  "other_trip",
];

const TRIP_KEYS_SET = new Set<string>(TRIP_TYPE_KEYS);

export function isTripEventType(eventType: string | null | undefined): boolean {
  return !!eventType && TRIP_KEYS_SET.has(eventType);
}

export function getTripTemplate(key: string | null | undefined): TripTemplate {
  if (!key || !TRIP_KEYS_SET.has(key)) return OTHER_TRIP;
  return tripTemplates[key as TripTypeKey] ?? OTHER_TRIP;
}
