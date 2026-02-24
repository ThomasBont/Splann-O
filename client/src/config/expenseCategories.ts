/**
 * Central expense category definitions with icons, i18n keys, and placeholders.
 * Categories are event-type aware: Party vs Trip have different default sets.
 */

import {
  Beef,
  Wheat,
  Beer,
  Zap,
  Car,
  Package,
  Receipt,
  Building2,
  Ticket,
  UtensilsCrossed,
  ShoppingCart,
  Cookie,
  Wrench,
  CircleParking,
  Heart,
  Film,
  LucideIcon,
} from "lucide-react";

export type CategoryKey =
  | "Meat"
  | "Bread"
  | "Drinks"
  | "Charcoal"
  | "Transportation"
  | "Transport"
  | "Food"
  | "Tickets"
  | "Accommodation"
  | "Activities"
  | "Groceries"
  | "Snacks"
  | "Supplies"
  | "Parking"
  | "Tips"
  | "Entertainment"
  | "Other";

export type CategoryDef = {
  key: CategoryKey;
  icon: LucideIcon;
  i18nKey: keyof CategoryTranslations;
  placeholderKey: keyof PlaceholderTranslations;
};

/** Maps category keys to i18n keys for labels. */
export interface CategoryTranslations {
  Meat: string;
  Bread: string;
  Drinks: string;
  Charcoal: string;
  Transportation: string;
  Transport: string;
  Food: string;
  Tickets: string;
  Accommodation: string;
  Activities: string;
  Groceries: string;
  Snacks: string;
  Supplies: string;
  Parking: string;
  Tips: string;
  Entertainment: string;
  Other: string;
}

/** Maps placeholder keys to i18n placeholders for item description input. */
export interface PlaceholderTranslations {
  meat: string;
  bread: string;
  drinks: string;
  charcoal: string;
  transport: string;
  food: string;
  tickets: string;
  accommodation: string;
  activities: string;
  groceries: string;
  snacks: string;
  supplies: string;
  parking: string;
  tips: string;
  entertainment: string;
  other: string;
}

const CATEGORY_DEFINITIONS: Record<CategoryKey, CategoryDef> = {
  Meat: { key: "Meat", icon: Beef, i18nKey: "Meat", placeholderKey: "meat" },
  Bread: { key: "Bread", icon: Wheat, i18nKey: "Bread", placeholderKey: "bread" },
  Drinks: { key: "Drinks", icon: Beer, i18nKey: "Drinks", placeholderKey: "drinks" },
  Charcoal: { key: "Charcoal", icon: Zap, i18nKey: "Charcoal", placeholderKey: "charcoal" },
  Transportation: { key: "Transportation", icon: Car, i18nKey: "Transportation", placeholderKey: "transport" },
  Transport: { key: "Transport", icon: Car, i18nKey: "Transport", placeholderKey: "transport" },
  Food: { key: "Food", icon: UtensilsCrossed, i18nKey: "Food", placeholderKey: "food" },
  Tickets: { key: "Tickets", icon: Ticket, i18nKey: "Tickets", placeholderKey: "tickets" },
  Accommodation: { key: "Accommodation", icon: Building2, i18nKey: "Accommodation", placeholderKey: "accommodation" },
  Activities: { key: "Activities", icon: Receipt, i18nKey: "Activities", placeholderKey: "activities" },
  Groceries: { key: "Groceries", icon: ShoppingCart, i18nKey: "Groceries", placeholderKey: "groceries" },
  Snacks: { key: "Snacks", icon: Cookie, i18nKey: "Snacks", placeholderKey: "snacks" },
  Supplies: { key: "Supplies", icon: Wrench, i18nKey: "Supplies", placeholderKey: "supplies" },
  Parking: { key: "Parking", icon: CircleParking, i18nKey: "Parking", placeholderKey: "parking" },
  Tips: { key: "Tips", icon: Heart, i18nKey: "Tips", placeholderKey: "tips" },
  Entertainment: { key: "Entertainment", icon: Film, i18nKey: "Entertainment", placeholderKey: "entertainment" },
  Other: { key: "Other", icon: Package, i18nKey: "Other", placeholderKey: "other" },
};

/** Default categories for barbecue (party subtype). */
const BBQ_DEFAULT: CategoryKey[] = ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];

/** Default categories for generic party events. */
const PARTY_DEFAULT: CategoryKey[] = ["Food", "Drinks", "Transport", "Tickets", "Other"];

/** Default categories for trip events. */
const TRIP_DEFAULT: CategoryKey[] = ["Transport", "Tickets", "Food", "Accommodation", "Other"];

/** Event-type specific overrides. Maps eventType -> ordered category list. */
const CATEGORIES_BY_EVENT_TYPE: Record<string, CategoryKey[]> = {
  barbecue: BBQ_DEFAULT,
  dinner_party: PARTY_DEFAULT,
  birthday: PARTY_DEFAULT,
  house_party: PARTY_DEFAULT,
  game_night: PARTY_DEFAULT,
  movie_night: PARTY_DEFAULT,
  pool_party: PARTY_DEFAULT,
  after_party: PARTY_DEFAULT,
  default: PARTY_DEFAULT,
  other_party: PARTY_DEFAULT,
  city_trip: ["Transport", "Tickets", "Food", "Accommodation", "Other"],
  road_trip: ["Transport", "Food", "Tickets", "Accommodation", "Other"],
  hiking_trip: ["Transport", "Food", "Tickets", "Accommodation", "Other"],
  beach_trip: ["Accommodation", "Food", "Tickets", "Transport", "Other"],
  ski_trip: ["Tickets", "Accommodation", "Drinks", "Other"],
  festival_trip: ["Tickets", "Accommodation", "Drinks", "Transport", "Other"],
  camping: ["Accommodation", "Food", "Other", "Transport"],
  weekend_getaway: ["Accommodation", "Food", "Transport", "Tickets", "Other"],
  business_trip: ["Accommodation", "Food", "Transport", "Other"],
  cinema: ["Tickets", "Food", "Drinks", "Other"],
  theme_park: ["Tickets", "Food", "Drinks", "Transport", "Other"],
  day_out: ["Food", "Drinks", "Transport", "Tickets", "Other"],
  other_trip: ["Food", "Drinks", "Transport", "Tickets", "Accommodation", "Other"],
  vacation: ["Accommodation", "Food", "Tickets", "Transport", "Other"],
  backpacking: ["Accommodation", "Transport", "Food", "Other"],
  bachelor_trip: ["Accommodation", "Tickets", "Drinks", "Other"],
  workation: ["Accommodation", "Other", "Food", "Transport"],
};

/** Map legacy/alternate stored category strings to canonical CategoryKey. */
export const NORMALIZE_CATEGORY: Record<string, CategoryKey> = {
  Transportation: "Transportation",
  Transport: "Transport",
  Meat: "Meat",
  Bread: "Bread",
  Drinks: "Drinks",
  Charcoal: "Charcoal",
  Other: "Other",
  Food: "Food",
  Tickets: "Tickets",
  Accommodation: "Accommodation",
  Activities: "Activities",
  Groceries: "Groceries",
  Snacks: "Snacks",
  Supplies: "Supplies",
  Parking: "Parking",
  Tips: "Tips",
  Entertainment: "Entertainment",
};

/**
 * Get expense categories for an event. Uses event type defaults, merged with
 * any custom categories from templateData. Custom categories appear after built-ins.
 */
export function getCategoriesForEvent(
  eventType: string | undefined,
  customCategories?: string[]
): string[] {
  const base = eventType
    ? (CATEGORIES_BY_EVENT_TYPE[eventType] ?? PARTY_DEFAULT)
    : BBQ_DEFAULT;
  const baseKeys = base as string[];
  if (!customCategories?.length) return baseKeys;
  const customSet = new Set(customCategories);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const k of baseKeys) {
    if (!seen.has(k)) {
      seen.add(k);
      result.push(k);
    }
  }
  for (const c of customCategories) {
    if (c && !seen.has(c)) {
      seen.add(c);
      result.push(c);
    }
  }
  return result;
}

/** Get category definition by key. Returns a generic def for unknown/custom keys. */
export function getCategoryDef(key: string): CategoryDef & { key: string } {
  const def = CATEGORY_DEFINITIONS[key as CategoryKey];
  if (def) return def;
  return {
    key,
    icon: Package,
    i18nKey: "Other",
    placeholderKey: "other",
  } as CategoryDef & { key: string };
}

/** Get placeholder key for a category (for i18n lookup). */
export function getPlaceholderKeyForCategory(categoryKey: string): keyof PlaceholderTranslations {
  const def = CATEGORY_DEFINITIONS[categoryKey as CategoryKey];
  if (def) return def.placeholderKey;
  return "other";
}
