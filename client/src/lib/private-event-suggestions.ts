import type { ExploreEvent } from "@/hooks/use-bbq-data";

export type PrivateSuggestionStateV1 = {
  schemaVersion: 2;
  lastFetchedAt: number | null;
  dismissedIds: number[];
  savedIds: number[];
  muted: boolean;
  enabled: boolean;
  cachedResults: ExploreEvent[];
  votesBySuggestionId: Record<string, Record<string, { vote: "up" | "maybe" | "down"; label?: string }>>;
};

export type SuggestionVote = "up" | "maybe" | "down";

const SCHEMA_VERSION = 2 as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getPrivateSuggestionsStorageKey(privateEventId: number) {
  return `splanno:suggestions:v1:${privateEventId}`;
}

export function defaultPrivateSuggestionState(): PrivateSuggestionStateV1 {
  return {
    schemaVersion: SCHEMA_VERSION,
    lastFetchedAt: null,
    dismissedIds: [],
    savedIds: [],
    muted: false,
    enabled: true,
    cachedResults: [],
    votesBySuggestionId: {},
  };
}

export function loadPrivateSuggestionState(privateEventId: number | null | undefined): PrivateSuggestionStateV1 {
  if (!privateEventId || typeof window === "undefined") return defaultPrivateSuggestionState();
  try {
    const raw = localStorage.getItem(getPrivateSuggestionsStorageKey(privateEventId));
    if (!raw) return defaultPrivateSuggestionState();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const schemaVersion = typeof parsed.schemaVersion === "number" ? parsed.schemaVersion : undefined;
    if (schemaVersion !== 1 && schemaVersion !== SCHEMA_VERSION) return defaultPrivateSuggestionState();
    const parsedState = parsed as Partial<PrivateSuggestionStateV1> & { votesBySuggestionId?: unknown };
    const votesBySuggestionId = ((): PrivateSuggestionStateV1["votesBySuggestionId"] => {
      if (!parsedState.votesBySuggestionId || typeof parsedState.votesBySuggestionId !== "object") return {};
      const result: PrivateSuggestionStateV1["votesBySuggestionId"] = {};
      for (const [suggestionId, rawVotes] of Object.entries(parsedState.votesBySuggestionId as Record<string, unknown>)) {
        if (!rawVotes || typeof rawVotes !== "object") continue;
        const nextVotes: Record<string, { vote: "up" | "maybe" | "down"; label?: string }> = {};
        for (const [userKey, rawVote] of Object.entries(rawVotes as Record<string, unknown>)) {
          if (!rawVote || typeof rawVote !== "object") continue;
          const vote = (rawVote as { vote?: unknown }).vote;
          if (vote !== "up" && vote !== "maybe" && vote !== "down") continue;
          const label = typeof (rawVote as { label?: unknown }).label === "string" ? (rawVote as { label: string }).label : undefined;
          nextVotes[userKey] = { vote, label };
        }
        result[suggestionId] = nextVotes;
      }
      return result;
    })();
    return {
      schemaVersion: SCHEMA_VERSION,
      lastFetchedAt: typeof parsedState.lastFetchedAt === "number" ? parsedState.lastFetchedAt : null,
      dismissedIds: Array.isArray(parsedState.dismissedIds) ? parsedState.dismissedIds.filter((x): x is number => Number.isInteger(x)) : [],
      savedIds: Array.isArray(parsedState.savedIds) ? parsedState.savedIds.filter((x): x is number => Number.isInteger(x)) : [],
      muted: !!parsedState.muted,
      enabled: parsedState.enabled !== false,
      cachedResults: Array.isArray(parsedState.cachedResults) ? parsedState.cachedResults : [],
      votesBySuggestionId,
    };
  } catch {
    return defaultPrivateSuggestionState();
  }
}

export function savePrivateSuggestionState(privateEventId: number | null | undefined, state: PrivateSuggestionStateV1) {
  if (!privateEventId || typeof window === "undefined") return;
  try {
    localStorage.setItem(getPrivateSuggestionsStorageKey(privateEventId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function isSuggestionCacheFresh(lastFetchedAt: number | null | undefined) {
  return !!lastFetchedAt && Date.now() - lastFetchedAt < DAY_MS;
}

function parseDateSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function isEligibleForLocalSuggestions(input: {
  city?: string | null;
  locationName?: string | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  area?: string | null;
  eventType?: string | null;
}): boolean {
  const hasLocation = !!(input.city || input.locationName);
  const hasStart = !!input.startAt;
  if (!hasLocation || !hasStart) return false;
  if (input.area === "trips") return true;
  const type = (input.eventType ?? "").toLowerCase();
  return /(trip|festival|travel|camp|hiking|beach|ski|weekend)/.test(type);
}

export async function getNearbyPublicEvents(input: {
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  startAt: string | Date;
  endAt?: string | Date | null;
  radiusKm?: number;
  sourceEvents?: ExploreEvent[];
}): Promise<ExploreEvent[]> {
  const source = input.sourceEvents ?? (await fetch("/api/explore/events", { credentials: "include" }).then((r) => r.ok ? r.json() : [])) as ExploreEvent[];
  const city = (input.city ?? "").trim().toLowerCase();
  const start = parseDateSafe(typeof input.startAt === "string" ? input.startAt : input.startAt.toISOString());
  const endBase = input.endAt
    ? parseDateSafe(typeof input.endAt === "string" ? input.endAt : input.endAt.toISOString())
    : start;
  if (!start) return [];
  const end = endBase ?? start;
  const from = start - (2 * DAY_MS);
  const to = end + (2 * DAY_MS);

  return (source ?? [])
    .filter((e) => {
      const t = parseDateSafe(e.date);
      if (!t || t < from || t > to) return false;
      if (city) return (e.city ?? "").trim().toLowerCase() === city || (e.countryName && !e.city);
      return true;
    })
    .sort((a, b) => {
      const aT = parseDateSafe(a.date) ?? Number.MAX_SAFE_INTEGER;
      const bT = parseDateSafe(b.date) ?? Number.MAX_SAFE_INTEGER;
      return aT - bT;
    });
}

export function getSuggestionDistanceLabel(input: {
  privateCity?: string | null;
  suggestionCity?: string | null;
  suggestionCountry?: string | null;
}) {
  const privateCity = (input.privateCity ?? "").trim().toLowerCase();
  const suggestionCity = (input.suggestionCity ?? "").trim().toLowerCase();
  if (privateCity && suggestionCity && privateCity === suggestionCity) return "Same city";
  if (input.suggestionCity) return `${input.suggestionCity}`;
  return input.suggestionCountry ?? "Nearby";
}
