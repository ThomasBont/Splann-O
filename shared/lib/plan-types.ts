export type PlanMainType = "trip" | "party";

export type PlanSubcategoryId =
  | "backpacking"
  | "city_trip"
  | "workation"
  | "road_trip"
  | "beach_getaway"
  | "ski_trip"
  | "weekend_escape"
  | "festival_trip"
  | "barbecue"
  | "cinema"
  | "game_night"
  | "dinner"
  | "birthday"
  | "house_party"
  | "drinks_night"
  | "brunch";

type SubcategoryDef = {
  id: PlanSubcategoryId;
  label: string;
  mainType: PlanMainType;
  eventTypeValue: string;
};

const SUBCATEGORY_DEFS: SubcategoryDef[] = [
  { id: "backpacking", label: "Backpacking", mainType: "trip", eventTypeValue: "backpacking" },
  { id: "city_trip", label: "City trip", mainType: "trip", eventTypeValue: "city_trip" },
  { id: "workation", label: "Workation", mainType: "trip", eventTypeValue: "workation" },
  { id: "road_trip", label: "Road trip", mainType: "trip", eventTypeValue: "road_trip" },
  { id: "beach_getaway", label: "Beach getaway", mainType: "trip", eventTypeValue: "beach_trip" },
  { id: "ski_trip", label: "Ski trip", mainType: "trip", eventTypeValue: "ski_trip" },
  { id: "weekend_escape", label: "Weekend escape", mainType: "trip", eventTypeValue: "weekend_getaway" },
  { id: "festival_trip", label: "Festival trip", mainType: "trip", eventTypeValue: "festival_trip" },
  { id: "barbecue", label: "Barbecue", mainType: "party", eventTypeValue: "barbecue" },
  { id: "cinema", label: "Cinema", mainType: "party", eventTypeValue: "cinema" },
  { id: "game_night", label: "Game night", mainType: "party", eventTypeValue: "game_night" },
  { id: "dinner", label: "Dinner", mainType: "party", eventTypeValue: "dinner_party" },
  { id: "birthday", label: "Birthday", mainType: "party", eventTypeValue: "birthday" },
  { id: "house_party", label: "House party", mainType: "party", eventTypeValue: "house_party" },
  { id: "drinks_night", label: "Drinks night", mainType: "party", eventTypeValue: "after_party" },
  { id: "brunch", label: "Picnic", mainType: "party", eventTypeValue: "day_out" },
];

const SUBCATEGORY_ALIAS_TO_CANONICAL: Record<string, PlanSubcategoryId> = {
  roadtrip: "road_trip",
  road_trip: "road_trip",
  beach_trip: "beach_getaway",
  beach_getaway: "beach_getaway",
  weekend_getaway: "weekend_escape",
  weekend_escape: "weekend_escape",
  cinema_night: "cinema",
  cinema: "cinema",
  club_night: "drinks_night",
  drinks_night: "drinks_night",
  picnic: "brunch",
  brunch: "brunch",
  game_night: "game_night",
  city_trip: "city_trip",
  backpacking: "backpacking",
  workation: "workation",
  ski_trip: "ski_trip",
  festival_trip: "festival_trip",
  barbecue: "barbecue",
  dinner: "dinner",
  birthday: "birthday",
  house_party: "house_party",
};

const EVENT_TYPE_TO_SUBCATEGORY: Record<string, PlanSubcategoryId> = {
  roadtrip: "road_trip",
  road_trip: "road_trip",
  beach_trip: "beach_getaway",
  ski_trip: "ski_trip",
  weekend_getaway: "weekend_escape",
  festival_trip: "festival_trip",
  city_trip: "city_trip",
  backpacking: "backpacking",
  workation: "workation",
  barbecue: "barbecue",
  cinema: "cinema",
  cinema_night: "cinema",
  game_night: "game_night",
  dinner_party: "dinner",
  dinner: "dinner",
  birthday: "birthday",
  house_party: "house_party",
  after_party: "drinks_night",
  club_night: "drinks_night",
  day_out: "brunch",
  picnic: "brunch",
};

const MAIN_TYPE_LABELS: Record<PlanMainType, string> = {
  trip: "Trip",
  party: "Party",
};

const SUBCATEGORY_BY_ID = Object.fromEntries(SUBCATEGORY_DEFS.map((item) => [item.id, item])) as Record<PlanSubcategoryId, SubcategoryDef>;

export const PLAN_MAIN_TYPE_OPTIONS = [
  { id: "trip" as const, label: "Trip", description: "Travel plans and shared costs" },
  { id: "party" as const, label: "Party", description: "Celebrate and coordinate with friends" },
];

export const PLAN_SUBCATEGORIES_BY_MAIN: Record<PlanMainType, SubcategoryDef[]> = {
  trip: SUBCATEGORY_DEFS.filter((item) => item.mainType === "trip"),
  party: SUBCATEGORY_DEFS.filter((item) => item.mainType === "party"),
};

export function normalizePlanMainType(value: unknown): PlanMainType | null {
  if (value !== "trip" && value !== "party") return null;
  return value;
}

export function normalizePlanSubcategory(value: unknown): PlanSubcategoryId | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return SUBCATEGORY_ALIAS_TO_CANONICAL[key] ?? null;
}

export function getMainTypeForSubcategory(subcategory: PlanSubcategoryId): PlanMainType {
  return SUBCATEGORY_BY_ID[subcategory].mainType;
}

export function isSubcategoryForMainType(mainType: PlanMainType, subcategory: PlanSubcategoryId | null | undefined): boolean {
  if (!subcategory) return true;
  return getMainTypeForSubcategory(subcategory) === mainType;
}

export function getPlanMainTypeLabel(mainType: PlanMainType): string {
  return MAIN_TYPE_LABELS[mainType];
}

export function getPlanSubcategoryLabel(subcategory: PlanSubcategoryId): string {
  return SUBCATEGORY_BY_ID[subcategory].label;
}

export function getPlanTypeDisplayLabel(mainType: PlanMainType, subcategory?: PlanSubcategoryId | null): string {
  const mainLabel = getPlanMainTypeLabel(mainType);
  if (!subcategory) return mainLabel;
  return `${mainLabel} — ${getPlanSubcategoryLabel(subcategory)}`;
}

export function getEventTypeForPlanType(mainType: PlanMainType, subcategory?: PlanSubcategoryId | null): string {
  if (subcategory) return SUBCATEGORY_BY_ID[subcategory].eventTypeValue;
  return mainType === "trip" ? "city_trip" : "barbecue";
}

export function inferPlanSubcategoryFromEventType(eventType: unknown): PlanSubcategoryId | null {
  if (typeof eventType !== "string") return null;
  const key = eventType.trim().toLowerCase();
  return EVENT_TYPE_TO_SUBCATEGORY[key] ?? normalizePlanSubcategory(key);
}

export function inferPlanMainTypeFromEventType(eventType: unknown): PlanMainType | null {
  const subcategory = inferPlanSubcategoryFromEventType(eventType);
  if (subcategory) return getMainTypeForSubcategory(subcategory);
  if (typeof eventType !== "string") return null;
  const value = eventType.trim().toLowerCase();
  if (value.includes("trip") || value.includes("workation") || value.includes("backpacking")) return "trip";
  if (value.includes("party") || value.includes("dinner") || value.includes("barbecue")) return "party";
  return null;
}

export function derivePlanTypeSelection(input: { templateData?: unknown; eventType?: unknown }): {
  mainType: PlanMainType | null;
  subcategory: PlanSubcategoryId | null;
} {
  const templateData = input.templateData && typeof input.templateData === "object"
    ? (input.templateData as Record<string, unknown>)
    : null;

  const rawMain = templateData?.mainCategory ?? templateData?.privateMainCategory ?? null;
  const rawSub = templateData?.subCategory ?? templateData?.privateSubCategory ?? null;
  const normalizedMain = normalizePlanMainType(rawMain);
  const normalizedSub = normalizePlanSubcategory(rawSub);

  let mainType = normalizedMain ?? inferPlanMainTypeFromEventType(input.eventType);
  let subcategory = normalizedSub ?? inferPlanSubcategoryFromEventType(input.eventType);

  if (mainType && subcategory && !isSubcategoryForMainType(mainType, subcategory)) {
    subcategory = null;
  }
  if (!mainType && subcategory) {
    mainType = getMainTypeForSubcategory(subcategory);
  }

  return { mainType: mainType ?? null, subcategory: subcategory ?? null };
}
