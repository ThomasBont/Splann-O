import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  DEFAULT_EVENT_HEADER_PREFERENCES,
  type EventHeaderPreferences,
  type UtilityAction,
} from "@/lib/event-header-preferences";

const DEFAULT_PREFS: EventHeaderPreferences = Object.freeze({
  ...DEFAULT_EVENT_HEADER_PREFERENCES,
  utilityOrder: [...DEFAULT_EVENT_HEADER_PREFERENCES.utilityOrder],
  utilityHidden: { ...(DEFAULT_EVENT_HEADER_PREFERENCES.utilityHidden ?? {}) },
});

type EventHeaderPreferencesContextValue = {
  prefs: EventHeaderPreferences;
  setPrefs: Dispatch<SetStateAction<EventHeaderPreferences>>;
};

const EventHeaderPreferencesContext = createContext<EventHeaderPreferencesContextValue | null>(null);
const VALID_ACTIONS: UtilityAction[] = ["share", "calendar", "settings"];
const warnedLoadIssues = new Set<string>();

function storageKey(eventId: string) {
  return `splanno:eventHeaderPrefs:${eventId}`;
}

function warnLoadIssueOnce(eventId: string, reason: string) {
  if (!import.meta.env.DEV) return;
  const key = `${eventId}:${reason}`;
  if (warnedLoadIssues.has(key)) return;
  warnedLoadIssues.add(key);
  console.warn("[event-header-prefs] invalid storage payload, using defaults", { eventId, reason });
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function hasValidMinimalShape(value: unknown): value is Partial<EventHeaderPreferences> {
  if (!isRecord(value)) return false;
  if ("utilityOrder" in value && !Array.isArray(value.utilityOrder)) return false;
  if ("utilityHidden" in value && value.utilityHidden != null && !isRecord(value.utilityHidden)) return false;
  if ("utilitySize" in value && value.utilitySize !== "compact" && value.utilitySize !== "normal") return false;
  if ("version" in value && typeof value.version !== "number") return false;
  return true;
}

function coercePrefs(input: unknown): EventHeaderPreferences {
  if (!hasValidMinimalShape(input)) return DEFAULT_PREFS;
  const raw = input as Partial<EventHeaderPreferences>;
  const orderInput = Array.isArray(raw.utilityOrder) ? raw.utilityOrder : DEFAULT_PREFS.utilityOrder;
  const seen = new Set<UtilityAction>();
  const order: UtilityAction[] = [];
  for (const item of orderInput) {
    if (!VALID_ACTIONS.includes(item as UtilityAction)) continue;
    const action = item as UtilityAction;
    if (seen.has(action)) continue;
    seen.add(action);
    order.push(action);
  }
  for (const action of VALID_ACTIONS) {
    if (!seen.has(action)) order.push(action);
  }

  const hiddenInput = isRecord(raw.utilityHidden) ? raw.utilityHidden : {};
  const hidden: Partial<Record<UtilityAction, boolean>> = {
    share: hiddenInput.share === true,
    calendar: hiddenInput.calendar === true,
    settings: hiddenInput.settings === true,
  };
  if (VALID_ACTIONS.every((action) => hidden[action] === true)) {
    hidden.settings = false;
  }

  return {
    version: typeof raw.version === "number" ? raw.version : DEFAULT_PREFS.version,
    utilityOrder: order,
    utilityHidden: hidden,
    utilitySize: raw.utilitySize === "normal" ? "normal" : "compact",
  };
}

function shallowEqual(a: EventHeaderPreferences, b: EventHeaderPreferences) {
  return (
    a.version === b.version &&
    a.utilitySize === b.utilitySize &&
    a.utilityOrder.length === b.utilityOrder.length &&
    a.utilityOrder.every((action, index) => action === b.utilityOrder[index]) &&
    (a.utilityHidden?.share ?? false) === (b.utilityHidden?.share ?? false) &&
    (a.utilityHidden?.calendar ?? false) === (b.utilityHidden?.calendar ?? false) &&
    (a.utilityHidden?.settings ?? false) === (b.utilityHidden?.settings ?? false)
  );
}

function loadPrefs(eventId?: string): EventHeaderPreferences {
  if (!eventId || typeof window === "undefined") return DEFAULT_PREFS;
  const key = storageKey(eventId);

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_PREFS;

    const parsed = safeJsonParse<unknown>(raw);
    if (!parsed || typeof parsed !== "object") {
      warnLoadIssueOnce(eventId, "parse");
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore cleanup failure
      }
      return DEFAULT_PREFS;
    }
    if (!hasValidMinimalShape(parsed)) {
      warnLoadIssueOnce(eventId, "shape");
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore cleanup failure
      }
      return DEFAULT_PREFS;
    }
    return coercePrefs(parsed);
  } catch {
    warnLoadIssueOnce(eventId, "storage");
    return DEFAULT_PREFS;
  }
}

export function EventHeaderPreferencesProvider({
  userKey,
  children,
}: {
  userKey: string;
  children: ReactNode;
}) {
  const eventId = String(userKey ?? "");
  const [prefs, setPrefs] = useState<EventHeaderPreferences>(() => loadPrefs(eventId));

  useEffect(() => {
    const next = loadPrefs(eventId);
    setPrefs((prev) => (shallowEqual(prev, next) ? prev : next));
  }, [eventId]);

  useEffect(() => {
    if (!eventId || typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey(eventId), JSON.stringify(prefs));
    } catch {
      // best-effort persistence
    }
  }, [eventId, prefs]);

  const value = useMemo(() => ({ prefs, setPrefs }), [prefs]);

  return (
    <EventHeaderPreferencesContext.Provider value={value}>
      {children}
    </EventHeaderPreferencesContext.Provider>
  );
}

export function useEventHeaderPreferences() {
  const context = useContext(EventHeaderPreferencesContext);
  if (context) return context;
  return {
    prefs: DEFAULT_PREFS,
    setPrefs: (() => undefined) as Dispatch<SetStateAction<EventHeaderPreferences>>,
  };
}
