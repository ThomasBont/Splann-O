/**
 * Central expense templates for recommended expense chips.
 * Keyed by event category + type. Used when allowOptInExpenses is enabled:
 * optInDefault true = participants must opt in; false = shared among all by default.
 */

import type { EventCategory } from "@/theme/eventThemes";
import { getEventTheme } from "@/theme/useEventTheme";
import type { TripType, PartyType } from "@/theme/eventThemes";

export interface ExpenseTemplateItem {
  /** Display label (also used as default item name in add-expense form). */
  label: string;
  /** Optional default amount hint (not enforced by backend). */
  defaultAmount?: number;
  /** Category for the expense (e.g. Transport, Food). */
  category: string;
  /** When event has allowOptInExpenses: true = participants opt in; false = shared among all by default. */
  optInDefault: boolean;
  /** @deprecated Use optInDefault. Kept for backward compat. */
  splitMode?: "equal" | "opt-in";
  /** Optional emoji or icon string for chip. */
  icon?: string;
}

type TripTypeKey = TripType;
type PartyTypeKey = PartyType;

/** Helper: opt-in default (participants must opt in). */
const O = true;
/** Helper: shared by default (everyone in). */
const S = false;

/** Trip expense templates by type. */
const TRIP_EXPENSE_TEMPLATES: Record<TripTypeKey, ExpenseTemplateItem[]> = {
  festival_trip: [
    { label: "Tickets", category: "Tickets", optInDefault: S, icon: "🎫" },
    { label: "Accommodation/Camping", category: "Accommodation", optInDefault: S, icon: "⛺" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍺" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Merch", category: "Other", optInDefault: O, icon: "👕" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍔" },
  ],
  road_trip: [
    { label: "Fuel", category: "Transport", optInDefault: S, icon: "⛽" },
    { label: "Toll/Parking", category: "Transport", optInDefault: S, icon: "🅿️" },
    { label: "Car rental", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏨" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍔" },
    { label: "Activities", category: "Tickets", optInDefault: O, icon: "🎯" },
  ],
  beach_trip: [
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏖️" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "✈️" },
    { label: "Sunscreen/Gear", category: "Other", optInDefault: O, icon: "🧴" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍽️" },
    { label: "Activities", category: "Tickets", optInDefault: O, icon: "🏊" },
  ],
  ski_trip: [
    { label: "Lift pass", category: "Tickets", optInDefault: S, icon: "🎿" },
    { label: "Rental gear", category: "Other", optInDefault: O, icon: "⛷️" },
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏔️" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Lessons", category: "Tickets", optInDefault: O, icon: "📚" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍲" },
  ],
  city_trip: [
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚇" },
    { label: "Public transit", category: "Transport", optInDefault: S, icon: "🚌" },
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏨" },
    { label: "Museums/Activities", category: "Tickets", optInDefault: O, icon: "🎨" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍴" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍷" },
  ],
  camping: [
    { label: "Camping spot", category: "Accommodation", optInDefault: S, icon: "⛺" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍳" },
    { label: "Firewood", category: "Other", optInDefault: S, icon: "🔥" },
    { label: "Gear", category: "Other", optInDefault: O, icon: "🎒" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
  ],
  hiking_trip: [
    { label: "Trail pass", category: "Tickets", optInDefault: S, icon: "🥾" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍳" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Gear", category: "Other", optInDefault: O, icon: "🎒" },
    { label: "Accommodation", category: "Accommodation", optInDefault: O, icon: "⛺" },
  ],
  weekend_getaway: [
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏨" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍽️" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Activities", category: "Tickets", optInDefault: O, icon: "🎯" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍷" },
  ],
  business_trip: [
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏨" },
    { label: "Flights", category: "Transport", optInDefault: S, icon: "✈️" },
    { label: "Meals", category: "Food", optInDefault: S, icon: "🍽️" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
  ],
  other_trip: [
    { label: "Accommodation", category: "Accommodation", optInDefault: S, icon: "🏨" },
    { label: "Food", category: "Food", optInDefault: S, icon: "🍽️" },
    { label: "Transport", category: "Transport", optInDefault: S, icon: "🚗" },
    { label: "Tickets", category: "Tickets", optInDefault: O, icon: "🎫" },
    { label: "Other", category: "Other", optInDefault: S, icon: "📦" },
  ],
};

/** Party expense templates by type. */
const PARTY_EXPENSE_TEMPLATES: Record<PartyTypeKey, ExpenseTemplateItem[]> = {
  barbecue: [
    { label: "Meat", category: "Meat", optInDefault: O, icon: "🥩" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍺" },
    { label: "Charcoal", category: "Charcoal", optInDefault: S, icon: "🔥" },
    { label: "Sides", category: "Food", optInDefault: S, icon: "🥗" },
    { label: "Sauces", category: "Other", optInDefault: S, icon: "🧴" },
    { label: "Disposable plates", category: "Other", optInDefault: S, icon: "🍽️" },
  ],
  birthday: [
    { label: "Cake", category: "Food", optInDefault: S, icon: "🎂" },
    { label: "Decor", category: "Other", optInDefault: S, icon: "🎈" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
    { label: "Gift", category: "Other", optInDefault: O, icon: "🎁" },
    { label: "Venue", category: "Tickets", optInDefault: S, icon: "🏠" },
  ],
  dinner_party: [
    { label: "Ingredients", category: "Food", optInDefault: S, icon: "🥕" },
    { label: "Wine", category: "Drinks", optInDefault: O, icon: "🍷" },
    { label: "Dessert", category: "Food", optInDefault: S, icon: "🍰" },
  ],
  house_party: [
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍺" },
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🥜" },
    { label: "Cleaning supplies", category: "Other", optInDefault: S, icon: "🧹" },
    { label: "Decorations", category: "Other", optInDefault: S, icon: "🎉" },
  ],
  game_night: [
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🍿" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
    { label: "New game", category: "Other", optInDefault: O, icon: "🎮" },
    { label: "Delivery food", category: "Food", optInDefault: S, icon: "🍕" },
  ],
  pool_party: [
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🍟" },
    { label: "Ice", category: "Other", optInDefault: S, icon: "🧊" },
    { label: "Decorations", category: "Other", optInDefault: S, icon: "🎈" },
    { label: "Sunscreen", category: "Other", optInDefault: O, icon: "🧴" },
  ],
  after_party: [
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍺" },
    { label: "Taxi", category: "Transport", optInDefault: O, icon: "🚕" },
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🍟" },
  ],
  movie_night: [
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🍿" },
    { label: "Streaming rental", category: "Tickets", optInDefault: S, icon: "🎬" },
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
    { label: "Pizza", category: "Food", optInDefault: S, icon: "🍕" },
    { label: "Decor", category: "Other", optInDefault: S, icon: "✨" },
  ],
  other_party: [
    { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🍺" },
    { label: "Snacks", category: "Food", optInDefault: S, icon: "🥜" },
    { label: "Decorations", category: "Other", optInDefault: S, icon: "🎉" },
    { label: "Transport", category: "Transport", optInDefault: O, icon: "🚗" },
  ],
};

const TRIP_KEYS = new Set<string>(Object.keys(TRIP_EXPENSE_TEMPLATES));
const PARTY_KEYS = new Set<string>(Object.keys(PARTY_EXPENSE_TEMPLATES));
const LEGACY_TRIP_MAP: Record<string, TripTypeKey> = {
  vacation: "beach_trip",
  backpacking: "camping",
  bachelor_trip: "other_trip",
  workation: "business_trip",
};
const LEGACY_PARTY_MAP: Record<string, PartyTypeKey> = {
  default: "other_party",
};

/** Generic template for unknown types. */
const GENERIC_TEMPLATE: ExpenseTemplateItem[] = [
  { label: "Food", category: "Food", optInDefault: S, icon: "🍽️" },
  { label: "Drinks", category: "Drinks", optInDefault: O, icon: "🥤" },
  { label: "Transport", category: "Transport", optInDefault: O, icon: "🚗" },
  { label: "Tickets", category: "Tickets", optInDefault: O, icon: "🎫" },
  { label: "Other", category: "Other", optInDefault: S, icon: "📦" },
];

/** Optional helper text per event type (e.g. Road trip fuel tracking). */
const TEMPLATE_HELPERS: Partial<Record<TripTypeKey | PartyTypeKey, string>> = {
  road_trip: "Track fuel costs per fill-up for accurate splits.",
};

/**
 * Get expense templates for an event. Falls back to category-Other or generic.
 */
export function getExpenseTemplates(
  category: EventCategory,
  type: string | null | undefined
): ExpenseTemplateItem[] {
  const key = (type || "").trim();
  if (category === "trip") {
    const tripKey = (LEGACY_TRIP_MAP[key] ??
      (TRIP_KEYS.has(key) ? key : "other_trip")) as TripTypeKey;
    return TRIP_EXPENSE_TEMPLATES[tripKey] ?? TRIP_EXPENSE_TEMPLATES.other_trip;
  }
  if (category === "party") {
    const partyKey = (LEGACY_PARTY_MAP[key] ??
      (PARTY_KEYS.has(key) ? key : "other_party")) as PartyTypeKey;
    return PARTY_EXPENSE_TEMPLATES[partyKey] ?? PARTY_EXPENSE_TEMPLATES.other_party;
  }
  return GENERIC_TEMPLATE;
}

/** Get optional helper text for an event type. */
export function getExpenseTemplateHelper(
  category: EventCategory,
  type: string | null | undefined
): string | undefined {
  const key = (type || "").trim();
  if (category === "trip") {
    const tripKey = (LEGACY_TRIP_MAP[key] ?? (TRIP_KEYS.has(key) ? key : "other_trip")) as TripTypeKey;
    return TEMPLATE_HELPERS[tripKey];
  }
  if (category === "party") {
    const partyKey = (LEGACY_PARTY_MAP[key] ?? (PARTY_KEYS.has(key) ? key : "other_party")) as PartyTypeKey;
    return TEMPLATE_HELPERS[partyKey];
  }
  return undefined;
}
