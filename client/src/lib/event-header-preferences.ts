export type UtilityAction = "share" | "calendar" | "settings";

export type EventHeaderPreferences = {
  version: number;
  utilityOrder: UtilityAction[];
  utilityHidden?: Partial<Record<UtilityAction, boolean>>;
  utilitySize?: "compact" | "normal";
};

export const EVENT_HEADER_PREFS_VERSION = 1;

export const DEFAULT_EVENT_HEADER_PREFERENCES: EventHeaderPreferences = {
  version: EVENT_HEADER_PREFS_VERSION,
  utilityOrder: ["share", "calendar", "settings"],
  utilityHidden: {},
  utilitySize: "compact",
};

const ACTIONS: UtilityAction[] = ["share", "calendar", "settings"];

export function sanitizeEventHeaderPreferences(input: unknown): EventHeaderPreferences {
  const fallback = DEFAULT_EVENT_HEADER_PREFERENCES;
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<EventHeaderPreferences>;
  const rawOrder = Array.isArray(raw.utilityOrder) ? raw.utilityOrder : [];
  const seen = new Set<string>();
  const order: UtilityAction[] = [];
  for (const item of rawOrder) {
    if (!ACTIONS.includes(item as UtilityAction)) continue;
    if (seen.has(item as string)) continue;
    seen.add(item as string);
    order.push(item as UtilityAction);
  }
  for (const action of ACTIONS) {
    if (!seen.has(action)) order.push(action);
  }

  const hiddenRaw = raw.utilityHidden && typeof raw.utilityHidden === "object" ? raw.utilityHidden : {};
  const hidden: Partial<Record<UtilityAction, boolean>> = {
    share: hiddenRaw.share === true,
    calendar: hiddenRaw.calendar === true,
    settings: hiddenRaw.settings === true,
  };
  const visibleCount = ACTIONS.filter((action) => !hidden[action]).length;
  if (visibleCount === 0) hidden.settings = false;

  return {
    version: EVENT_HEADER_PREFS_VERSION,
    utilityOrder: order,
    utilityHidden: hidden,
    utilitySize: raw.utilitySize === "normal" ? "normal" : "compact",
  };
}

export function eventHeaderPrefsStorageKey(userIdOrName: string) {
  return `splanno:eventHeaderPrefs:${userIdOrName}`;
}
