export type DefaultStartPage = "home" | "private" | "public";

export type LocalUserPreferences = {
  schemaVersion: 1;
  defaultStartPage: DefaultStartPage;
  emailNotifications: boolean;
  activityNotifications: boolean;
};

const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = "splanno:user-preferences:v1";

const DEFAULT_PREFERENCES: LocalUserPreferences = {
  schemaVersion: SCHEMA_VERSION,
  defaultStartPage: "home",
  emailNotifications: true,
  activityNotifications: true,
};

function getStorageKey(userId: number | null | undefined): string | null {
  if (!userId) return null;
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadLocalUserPreferences(userId: number | null | undefined): LocalUserPreferences {
  const key = getStorageKey(userId);
  if (!key || typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<LocalUserPreferences> | null;
    if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return DEFAULT_PREFERENCES;
    return {
      schemaVersion: SCHEMA_VERSION,
      defaultStartPage:
        parsed.defaultStartPage === "private" || parsed.defaultStartPage === "public" || parsed.defaultStartPage === "home"
          ? parsed.defaultStartPage
          : DEFAULT_PREFERENCES.defaultStartPage,
      emailNotifications: typeof parsed.emailNotifications === "boolean" ? parsed.emailNotifications : DEFAULT_PREFERENCES.emailNotifications,
      activityNotifications: typeof parsed.activityNotifications === "boolean" ? parsed.activityNotifications : DEFAULT_PREFERENCES.activityNotifications,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveLocalUserPreferences(
  userId: number | null | undefined,
  updates: Partial<Omit<LocalUserPreferences, "schemaVersion">>,
): LocalUserPreferences {
  const current = loadLocalUserPreferences(userId);
  const next: LocalUserPreferences = {
    ...current,
    ...updates,
    schemaVersion: SCHEMA_VERSION,
  };
  const key = getStorageKey(userId);
  if (key && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // noop
    }
  }
  return next;
}

