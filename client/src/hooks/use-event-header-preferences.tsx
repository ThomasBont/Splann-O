import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_EVENT_HEADER_PREFERENCES,
  eventHeaderPrefsStorageKey,
  sanitizeEventHeaderPreferences,
  type EventHeaderPreferences,
} from "@/lib/event-header-preferences";

type EventHeaderPreferencesContextValue = {
  savedPrefs: EventHeaderPreferences;
  effectivePrefs: EventHeaderPreferences;
  draftPrefs: EventHeaderPreferences | null;
  beginDraft: () => void;
  updateDraft: (updater: (prev: EventHeaderPreferences) => EventHeaderPreferences) => void;
  cancelDraft: () => void;
  saveDraft: () => void;
};

const EventHeaderPreferencesContext = createContext<EventHeaderPreferencesContextValue | null>(null);

export function EventHeaderPreferencesProvider({
  userKey,
  children,
}: {
  userKey: string;
  children: ReactNode;
}) {
  const [savedPrefs, setSavedPrefs] = useState<EventHeaderPreferences>(DEFAULT_EVENT_HEADER_PREFERENCES);
  const [draftPrefs, setDraftPrefs] = useState<EventHeaderPreferences | null>(null);

  const storageKey = useMemo(() => eventHeaderPrefsStorageKey(userKey), [userKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      setSavedPrefs(sanitizeEventHeaderPreferences(raw ? JSON.parse(raw) : null));
    } catch {
      setSavedPrefs(DEFAULT_EVENT_HEADER_PREFERENCES);
    }
    setDraftPrefs(null);
  }, [storageKey]);

  const beginDraft = () => {
    setDraftPrefs(structuredClone(savedPrefs));
  };

  const updateDraft = (updater: (prev: EventHeaderPreferences) => EventHeaderPreferences) => {
    setDraftPrefs((prev) => sanitizeEventHeaderPreferences(updater(prev ?? savedPrefs)));
  };

  const cancelDraft = () => {
    setDraftPrefs(null);
  };

  const saveDraft = () => {
    if (!draftPrefs) return;
    const next = sanitizeEventHeaderPreferences(draftPrefs);
    setSavedPrefs(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
    setDraftPrefs(null);
  };

  const value: EventHeaderPreferencesContextValue = {
    savedPrefs,
    effectivePrefs: draftPrefs ?? savedPrefs,
    draftPrefs,
    beginDraft,
    updateDraft,
    cancelDraft,
    saveDraft,
  };

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
    savedPrefs: DEFAULT_EVENT_HEADER_PREFERENCES,
    effectivePrefs: DEFAULT_EVENT_HEADER_PREFERENCES,
    draftPrefs: null,
    beginDraft: () => undefined,
    updateDraft: () => undefined,
    cancelDraft: () => undefined,
    saveDraft: () => undefined,
  };
}

