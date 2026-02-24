/**
 * Central expense templates for recommended expense chips.
 * Keyed by event category + type. Used when allowOptInExpenses is enabled:
 * splitMode "opt-in" = participants must opt in; "equal" = split among all.
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
  /** When event has allowOptInExpenses: "opt-in" = participants opt in; "equal" = split among all. */
  splitMode?: "equal" | "opt-in";
  /** Optional emoji or icon string for chip. */
  icon?: string;
}

type TripTypeKey = TripType;
type PartyTypeKey = PartyType;

/** Trip expense templates by type. */
const TRIP_EXPENSE_TEMPLATES: Record<TripTypeKey, ExpenseTemplateItem[]> = {
  festival_trip: [
    { label: "Tickets", category: "Tickets", splitMode: "equal", icon: "🎫" },
    { label: "Accommodation/Camping", category: "Accommodation", splitMode: "equal", icon: "⛺" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍺" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Merch", category: "Other", splitMode: "opt-in", icon: "👕" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍔" },
  ],
  road_trip: [
    { label: "Fuel", category: "Transport", splitMode: "equal", icon: "⛽" },
    { label: "Toll/Parking", category: "Transport", splitMode: "equal", icon: "🅿️" },
    { label: "Car rental", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏨" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍔" },
    { label: "Activities", category: "Tickets", splitMode: "opt-in", icon: "🎯" },
  ],
  beach_trip: [
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏖️" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "✈️" },
    { label: "Sunscreen/Gear", category: "Other", splitMode: "opt-in", icon: "🧴" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍽️" },
    { label: "Activities", category: "Tickets", splitMode: "opt-in", icon: "🏊" },
  ],
  ski_trip: [
    { label: "Lift pass", category: "Tickets", splitMode: "equal", icon: "🎿" },
    { label: "Rental gear", category: "Other", splitMode: "opt-in", icon: "⛷️" },
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏔️" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Lessons", category: "Tickets", splitMode: "opt-in", icon: "📚" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍲" },
  ],
  city_trip: [
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚇" },
    { label: "Public transit", category: "Transport", splitMode: "equal", icon: "🚌" },
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏨" },
    { label: "Museums/Activities", category: "Tickets", splitMode: "opt-in", icon: "🎨" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍴" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍷" },
  ],
  camping: [
    { label: "Camping spot", category: "Accommodation", splitMode: "equal", icon: "⛺" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍳" },
    { label: "Firewood", category: "Other", splitMode: "equal", icon: "🔥" },
    { label: "Gear", category: "Other", splitMode: "opt-in", icon: "🎒" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
  ],
  hiking_trip: [
    { label: "Trail pass", category: "Tickets", splitMode: "equal", icon: "🥾" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍳" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Gear", category: "Other", splitMode: "opt-in", icon: "🎒" },
    { label: "Accommodation", category: "Accommodation", splitMode: "opt-in", icon: "⛺" },
  ],
  weekend_getaway: [
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏨" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍽️" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Activities", category: "Tickets", splitMode: "opt-in", icon: "🎯" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍷" },
  ],
  business_trip: [
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏨" },
    { label: "Flights", category: "Transport", splitMode: "equal", icon: "✈️" },
    { label: "Meals", category: "Food", splitMode: "equal", icon: "🍽️" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
  ],
  other_trip: [
    { label: "Accommodation", category: "Accommodation", splitMode: "equal", icon: "🏨" },
    { label: "Food", category: "Food", splitMode: "equal", icon: "🍽️" },
    { label: "Transport", category: "Transport", splitMode: "equal", icon: "🚗" },
    { label: "Tickets", category: "Tickets", splitMode: "opt-in", icon: "🎫" },
    { label: "Other", category: "Other", splitMode: "equal", icon: "📦" },
  ],
};

/** Party expense templates by type. */
const PARTY_EXPENSE_TEMPLATES: Record<PartyTypeKey, ExpenseTemplateItem[]> = {
  barbecue: [
    { label: "Meat", category: "Meat", splitMode: "opt-in", icon: "🥩" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍺" },
    { label: "Charcoal", category: "Charcoal", splitMode: "equal", icon: "🔥" },
    { label: "Sides", category: "Food", splitMode: "equal", icon: "🥗" },
    { label: "Sauces", category: "Other", splitMode: "equal", icon: "🧴" },
    { label: "Disposable plates", category: "Other", splitMode: "equal", icon: "🍽️" },
  ],
  birthday: [
    { label: "Cake", category: "Food", splitMode: "equal", icon: "🎂" },
    { label: "Decor", category: "Other", splitMode: "equal", icon: "🎈" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
    { label: "Gift", category: "Other", splitMode: "opt-in", icon: "🎁" },
    { label: "Venue", category: "Tickets", splitMode: "equal", icon: "🏠" },
  ],
  dinner_party: [
    { label: "Ingredients", category: "Food", splitMode: "equal", icon: "🥕" },
    { label: "Wine", category: "Drinks", splitMode: "opt-in", icon: "🍷" },
    { label: "Dessert", category: "Food", splitMode: "equal", icon: "🍰" },
  ],
  house_party: [
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍺" },
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🥜" },
    { label: "Cleaning supplies", category: "Other", splitMode: "equal", icon: "🧹" },
    { label: "Decorations", category: "Other", splitMode: "equal", icon: "🎉" },
  ],
  game_night: [
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🍿" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
    { label: "New game", category: "Other", splitMode: "opt-in", icon: "🎮" },
    { label: "Delivery food", category: "Food", splitMode: "equal", icon: "🍕" },
  ],
  pool_party: [
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🍟" },
    { label: "Ice", category: "Other", splitMode: "equal", icon: "🧊" },
    { label: "Decorations", category: "Other", splitMode: "equal", icon: "🎈" },
    { label: "Sunscreen", category: "Other", splitMode: "opt-in", icon: "🧴" },
  ],
  after_party: [
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍺" },
    { label: "Taxi", category: "Transport", splitMode: "opt-in", icon: "🚕" },
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🍟" },
  ],
  movie_night: [
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🍿" },
    { label: "Streaming rental", category: "Tickets", splitMode: "equal", icon: "🎬" },
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
    { label: "Pizza", category: "Food", splitMode: "equal", icon: "🍕" },
    { label: "Decor", category: "Other", splitMode: "equal", icon: "✨" },
  ],
  other_party: [
    { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🍺" },
    { label: "Snacks", category: "Food", splitMode: "equal", icon: "🥜" },
    { label: "Decorations", category: "Other", splitMode: "equal", icon: "🎉" },
    { label: "Transport", category: "Transport", splitMode: "opt-in", icon: "🚗" },
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
  { label: "Food", category: "Food", splitMode: "equal", icon: "🍽️" },
  { label: "Drinks", category: "Drinks", splitMode: "opt-in", icon: "🥤" },
  { label: "Transport", category: "Transport", splitMode: "opt-in", icon: "🚗" },
  { label: "Tickets", category: "Tickets", splitMode: "opt-in", icon: "🎫" },
  { label: "Other", category: "Other", splitMode: "equal", icon: "📦" },
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
