/**
 * Local storage for expense reactions (emoji + count).
 * Keyed by event/scope so reactions persist per event.
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "splanno-reactions";

export const REACTION_EMOJIS = [
  "👍", "❤️", "🔥", "😂", "💸", "👏", "😮", "😍", "🤝", "✅",
  "🎉", "🙌", "🥳", "🍻", "🥩", "🍷", "🌭", "😋", "🤯", "👀",
  "🙏", "💯", "😅", "🤩",
] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;
export type ReactionUsersByEmoji = Partial<Record<ReactionEmoji, string[]>>;
type UserReactionMap = Record<string, ReactionEmoji>;
type ReactionState = Record<number | string, UserReactionMap>;
type LegacyReactionState = Record<number | string, ReactionCounts>;

function getStorageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}-${scopeId}`;
}

function isEmoji(v: unknown): v is ReactionEmoji {
  return typeof v === "string" && (REACTION_EMOJIS as readonly string[]).includes(v);
}

function migrateLegacyCountsToUsers(data: LegacyReactionState): ReactionState {
  const migrated: ReactionState = {};
  Object.entries(data ?? {}).forEach(([expenseId, counts]) => {
    const users: UserReactionMap = {};
    let idx = 0;
    Object.entries(counts ?? {}).forEach(([emoji, count]) => {
      const n = Number(count) || 0;
      if (!isEmoji(emoji) || n <= 0) return;
      for (let i = 0; i < n; i += 1) {
        users[`legacy-${idx + 1}`] = emoji;
        idx += 1;
      }
    });
    migrated[expenseId] = users;
  });
  return migrated;
}

function loadAll(scopeId: string): ReactionState {
  try {
    const raw = localStorage.getItem(getStorageKey(scopeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sample = Object.values(parsed ?? {})[0];
    if (!sample || typeof sample !== "object") return {};
    const sampleValue = Object.values(sample as Record<string, unknown>)[0];
    if (typeof sampleValue === "number") {
      return migrateLegacyCountsToUsers(parsed as LegacyReactionState);
    }
    const normalized: ReactionState = {};
    Object.entries(parsed).forEach(([expenseId, userMap]) => {
      if (!userMap || typeof userMap !== "object") return;
      const nextMap: UserReactionMap = {};
      Object.entries(userMap as Record<string, unknown>).forEach(([userId, emoji]) => {
        if (isEmoji(emoji)) nextMap[userId] = emoji;
      });
      normalized[expenseId] = nextMap;
    });
    return normalized;
  } catch {
    return {};
  }
}

function saveAll(scopeId: string, data: ReactionState) {
  try {
    localStorage.setItem(getStorageKey(scopeId), JSON.stringify(data));
  } catch {}
}

function toCounts(userMap: UserReactionMap | undefined): ReactionCounts {
  const counts: ReactionCounts = {};
  if (!userMap) return counts;
  Object.values(userMap).forEach((emoji) => {
    counts[emoji] = (counts[emoji] ?? 0) + 1;
  });
  return counts;
}

function toUsersByEmoji(userMap: UserReactionMap | undefined): ReactionUsersByEmoji {
  const byEmoji: ReactionUsersByEmoji = {};
  if (!userMap) return byEmoji;
  Object.entries(userMap).forEach(([userId, emoji]) => {
    const label = userId.startsWith("legacy-") ? "Someone" : userId;
    byEmoji[emoji] = [...(byEmoji[emoji] ?? []), label];
  });
  Object.keys(byEmoji).forEach((emoji) => {
    const key = emoji as ReactionEmoji;
    byEmoji[key] = [...(byEmoji[key] ?? [])].sort((a, b) => a.localeCompare(b));
  });
  return byEmoji;
}

export function useExpenseReactions(scopeId: string) {
  const [state, setState] = useState<ReactionState>(() => loadAll(scopeId));

  useEffect(() => {
    setState(loadAll(scopeId));
  }, [scopeId]);

  const addReaction = useCallback(
    (expenseId: number | string, emoji: ReactionEmoji, userId = "anon") => {
      setState((prev) => {
        const next = { ...prev };
        const reactionsForExpense = { ...(next[expenseId] ?? {}) };
        if (reactionsForExpense[userId] === emoji) {
          delete reactionsForExpense[userId];
        } else {
          reactionsForExpense[userId] = emoji;
        }
        next[expenseId] = reactionsForExpense;
        saveAll(scopeId, next);
        return next;
      });
    },
    [scopeId]
  );

  const getReactions = useCallback(
    (expenseId: number | string): ReactionCounts => {
      return toCounts(state[expenseId]);
    },
    [state]
  );

  const getReactionUsers = useCallback(
    (expenseId: number | string): ReactionUsersByEmoji => {
      return toUsersByEmoji(state[expenseId]);
    },
    [state]
  );

  const getUserReaction = useCallback(
    (expenseId: number | string, userId = "anon"): ReactionEmoji | null => {
      return state[expenseId]?.[userId] ?? null;
    },
    [state]
  );

  const hydrate = useCallback((data: Record<number | string, ReactionCounts>) => {
    const migrated = migrateLegacyCountsToUsers(data);
    setState(migrated);
    saveAll(scopeId, migrated);
  }, [scopeId]);

  return { reactionsByExpense: state, addReaction, getReactions, getReactionUsers, getUserReaction, hydrate };
}
