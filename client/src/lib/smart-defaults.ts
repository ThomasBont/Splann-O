type SmartDefaultsVersion = 1;
const STORAGE_KEY = "splanno-smart-defaults-v1";

export type SmartGroupDefaults = {
  groupId: number;
  currencyCode?: string;
  splitMethod?: string;
  lastParticipantIds?: number[];
  payerUserId?: string;
  lastPayerParticipantId?: number;
  lastCategory?: string;
  updatedAt: number;
};

export type SmartGroupStats = {
  groupId: number;
  userId?: string;
  payerCountByUserId?: Record<string, number>;
  payerCountByParticipantId?: Record<string, number>;
  recentPayerUserIds?: string[];
  recentPayerParticipantIds?: number[];
  participantPickCount?: Record<string, number>;
  updatedAt: number;
};

type SmartDefaultsStore = {
  schemaVersion: SmartDefaultsVersion;
  groups: Record<string, SmartGroupDefaults>;
  stats: Record<string, SmartGroupStats>;
};

export type SmartGroupMember = {
  id: number;
  userId?: string | null;
  name?: string | null;
};

export type ResolvedExpenseDefaults = {
  currencyCode?: string;
  splitMethod: string;
  payerParticipantId: number | null;
  payerSuggestionSource: "fallback" | "lastUsed" | "mostCommon";
  payerSuggestionConfidence: "low" | "medium" | "high";
  orderedParticipantIds: number[];
  lastParticipantIds: number[];
};

const RECENT_PAYER_WINDOW = 5;
const DOMINANCE_THRESHOLD = 2;

function defaultStore(): SmartDefaultsStore {
  return { schemaVersion: 1, groups: {}, stats: {} };
}

function loadStore(): SmartDefaultsStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as Partial<SmartDefaultsStore>;
    if (parsed.schemaVersion !== 1) return defaultStore();
    return {
      schemaVersion: 1,
      groups: parsed.groups ?? {},
      stats: parsed.stats ?? {},
    };
  } catch {
    return defaultStore();
  }
}

function saveStore(store: SmartDefaultsStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota/storage errors
  }
}

export function getSmartDefaultsForGroup(groupId: number | null | undefined): {
  defaults?: SmartGroupDefaults;
  stats?: SmartGroupStats;
} {
  if (!groupId) return {};
  const store = loadStore();
  const key = String(groupId);
  return {
    defaults: store.groups[key],
    stats: store.stats[key],
  };
}

export function resolveExpenseDefaults(input: {
  groupId: number | null | undefined;
  currentUserId?: string | null;
  groupMembers: SmartGroupMember[];
  storedDefaults?: SmartGroupDefaults;
  storedStats?: SmartGroupStats;
  groupHomeCurrencyCode?: string | null;
  appDefaultCurrencyCode?: string | null;
}): ResolvedExpenseDefaults {
  const members = input.groupMembers ?? [];
  const validMemberIds = new Set(members.map((m) => m.id));
  const currentUserParticipant = members.find((m) => m.userId && input.currentUserId && m.userId === input.currentUserId) ?? null;

  const seenLastParticipantIds = new Set<number>();
  const cleanedLastParticipantIds = (input.storedDefaults?.lastParticipantIds ?? []).filter((id) => {
    if (!validMemberIds.has(id) || seenLastParticipantIds.has(id)) return false;
    seenLastParticipantIds.add(id);
    return true;
  });

  const preferredCurrency = input.storedDefaults?.currencyCode
    ?? input.groupHomeCurrencyCode
    ?? input.appDefaultCurrencyCode
    ?? undefined;

  const payerByUserCounts = input.storedStats?.payerCountByUserId ?? {};
  const payerByParticipantCounts = input.storedStats?.payerCountByParticipantId ?? {};
  let preferredPayerParticipantId: number | null = null;
  let payerSuggestionSource: ResolvedExpenseDefaults["payerSuggestionSource"] = "fallback";
  let payerSuggestionConfidence: ResolvedExpenseDefaults["payerSuggestionConfidence"] = "low";
  let mostCommonWonByDominance = false;

  const recentPayerParticipantId = (() => {
    const recentParticipantIds = (input.storedStats?.recentPayerParticipantIds ?? []).slice(0, RECENT_PAYER_WINDOW);
    for (const id of recentParticipantIds) {
      if (validMemberIds.has(id)) return id;
    }
    if (input.storedDefaults?.lastPayerParticipantId && validMemberIds.has(input.storedDefaults.lastPayerParticipantId)) {
      return input.storedDefaults.lastPayerParticipantId;
    }
    const recentUserIds = (input.storedStats?.recentPayerUserIds ?? []).slice(0, RECENT_PAYER_WINDOW);
    for (const userId of recentUserIds) {
      const member = members.find((m) => m.userId === userId);
      if (member) return member.id;
    }
    const storedPayerUserId = input.storedDefaults?.payerUserId;
    if (storedPayerUserId) {
      return members.find((m) => m.userId === storedPayerUserId)?.id ?? null;
    }
    return null;
  })();

  const topPayerParticipantId = (() => {
    const topUserId = Object.entries(payerByUserCounts)
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        const aRecent = (input.storedStats?.recentPayerUserIds ?? []).indexOf(a[0]);
        const bRecent = (input.storedStats?.recentPayerUserIds ?? []).indexOf(b[0]);
        return (aRecent === -1 ? Number.MAX_SAFE_INTEGER : aRecent) - (bRecent === -1 ? Number.MAX_SAFE_INTEGER : bRecent);
      })[0]?.[0];
    if (topUserId) return members.find((m) => m.userId === topUserId)?.id ?? null;

    const topParticipant = Object.entries(payerByParticipantCounts)
      .map(([id, count]) => ({ id: Number(id), count }))
      .filter((entry) => validMemberIds.has(entry.id))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const aRecent = (input.storedStats?.recentPayerParticipantIds ?? []).indexOf(a.id);
        const bRecent = (input.storedStats?.recentPayerParticipantIds ?? []).indexOf(b.id);
        return (aRecent === -1 ? Number.MAX_SAFE_INTEGER : aRecent) - (bRecent === -1 ? Number.MAX_SAFE_INTEGER : bRecent);
      })[0];
    return topParticipant?.id ?? null;
  })();

  const getPayerCount = (participantId: number | null) => {
    if (!participantId) return 0;
    const member = members.find((m) => m.id === participantId);
    if (member?.userId) return payerByUserCounts[member.userId] ?? 0;
    return payerByParticipantCounts[String(participantId)] ?? 0;
  };

  if (recentPayerParticipantId && topPayerParticipantId) {
    const recentCount = getPayerCount(recentPayerParticipantId);
    const topCount = getPayerCount(topPayerParticipantId);
    const isDifferentPayer = recentPayerParticipantId !== topPayerParticipantId;
    const topDominates = isDifferentPayer && topCount > 0 && topCount >= Math.max(1, recentCount) * DOMINANCE_THRESHOLD;
    if (!topDominates) {
      preferredPayerParticipantId = recentPayerParticipantId;
      payerSuggestionSource = "lastUsed";
      payerSuggestionConfidence = "medium";
    } else {
      preferredPayerParticipantId = topPayerParticipantId;
      payerSuggestionSource = "mostCommon";
      payerSuggestionConfidence = "high";
      mostCommonWonByDominance = true;
    }
  } else if (recentPayerParticipantId) {
    preferredPayerParticipantId = recentPayerParticipantId;
    payerSuggestionSource = "lastUsed";
    payerSuggestionConfidence = "medium";
  } else if (topPayerParticipantId) {
    preferredPayerParticipantId = topPayerParticipantId;
    payerSuggestionSource = "mostCommon";
    payerSuggestionConfidence = mostCommonWonByDominance ? "high" : "medium";
  }

  if (!preferredPayerParticipantId && currentUserParticipant) {
    preferredPayerParticipantId = currentUserParticipant.id;
  }
  if (!preferredPayerParticipantId && members.length > 0) {
    preferredPayerParticipantId = members[0].id;
  }

  const participantPickCount = input.storedStats?.participantPickCount ?? {};
  const ordered = [...members]
    .sort((a, b) => {
      const aIsCurrent = currentUserParticipant?.id === a.id ? 1 : 0;
      const bIsCurrent = currentUserParticipant?.id === b.id ? 1 : 0;
      if (aIsCurrent !== bIsCurrent) return bIsCurrent - aIsCurrent;

      const aLast = cleanedLastParticipantIds.includes(a.id) ? 1 : 0;
      const bLast = cleanedLastParticipantIds.includes(b.id) ? 1 : 0;
      if (aLast !== bLast) return bLast - aLast;

      const aCount = participantPickCount[String(a.id)] ?? 0;
      const bCount = participantPickCount[String(b.id)] ?? 0;
      if (aCount !== bCount) return bCount - aCount;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    })
    .map((m) => m.id);

  return {
    currencyCode: preferredCurrency,
    splitMethod: input.storedDefaults?.splitMethod ?? "equally",
    payerParticipantId: preferredPayerParticipantId,
    payerSuggestionSource,
    payerSuggestionConfidence,
    orderedParticipantIds: ordered,
    lastParticipantIds: cleanedLastParticipantIds,
  };
}

export function updateSmartDefaultsAfterExpenseCreate(input: {
  groupId: number;
  currentUserId?: string | null;
  currencyCode?: string | null;
  splitMethod?: string | null;
  payerParticipantId: number;
  payerUserId?: string | null;
  participantIds?: number[];
  category?: string | null;
}): void {
  const store = loadStore();
  const key = String(input.groupId);
  const now = Date.now();
  const participantIds = (input.participantIds ?? [input.payerParticipantId]).filter((id): id is number => Number.isInteger(id));

  const prevDefaults = store.groups[key];
  store.groups[key] = {
    groupId: input.groupId,
    currencyCode: input.currencyCode ?? prevDefaults?.currencyCode,
    splitMethod: input.splitMethod ?? prevDefaults?.splitMethod,
    lastParticipantIds: participantIds,
    payerUserId: input.payerUserId ?? prevDefaults?.payerUserId,
    lastPayerParticipantId: input.payerParticipantId,
    lastCategory: input.category ?? prevDefaults?.lastCategory,
    updatedAt: now,
  };

  const prevStats = store.stats[key];
  const nextPayerByUser = { ...(prevStats?.payerCountByUserId ?? {}) };
  if (input.payerUserId) nextPayerByUser[input.payerUserId] = (nextPayerByUser[input.payerUserId] ?? 0) + 1;
  const nextPayerByParticipant = { ...(prevStats?.payerCountByParticipantId ?? {}) };
  nextPayerByParticipant[String(input.payerParticipantId)] = (nextPayerByParticipant[String(input.payerParticipantId)] ?? 0) + 1;
  const nextRecentPayerUserIds = [...(prevStats?.recentPayerUserIds ?? [])];
  if (input.payerUserId) {
    const deduped = nextRecentPayerUserIds.filter((id) => id !== input.payerUserId);
    nextRecentPayerUserIds.splice(0, nextRecentPayerUserIds.length, input.payerUserId, ...deduped);
    nextRecentPayerUserIds.length = RECENT_PAYER_WINDOW;
  }
  const nextRecentPayerParticipantIds = [input.payerParticipantId, ...(prevStats?.recentPayerParticipantIds ?? []).filter((id) => id !== input.payerParticipantId)]
    .slice(0, RECENT_PAYER_WINDOW);
  const nextParticipantPickCount = { ...(prevStats?.participantPickCount ?? {}) };
  participantIds.forEach((id) => {
    nextParticipantPickCount[String(id)] = (nextParticipantPickCount[String(id)] ?? 0) + 1;
  });

  store.stats[key] = {
    groupId: input.groupId,
    userId: input.currentUserId ?? prevStats?.userId,
    payerCountByUserId: nextPayerByUser,
    payerCountByParticipantId: nextPayerByParticipant,
    recentPayerUserIds: nextRecentPayerUserIds,
    recentPayerParticipantIds: nextRecentPayerParticipantIds,
    participantPickCount: nextParticipantPickCount,
    updatedAt: now,
  };

  saveStore(store);
}
