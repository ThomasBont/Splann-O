/**
 * Local storage for expense reactions (emoji + count).
 * Keyed by event/scope so reactions persist per event.
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_PREFIX = "splanno-reactions";

export const REACTION_EMOJIS = ["👍", "❤️", "🔥", "😂", "💸"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

function getStorageKey(scopeId: string): string {
  return `${STORAGE_PREFIX}-${scopeId}`;
}

function loadAll(scopeId: string): Record<number | string, ReactionCounts> {
  try {
    const raw = localStorage.getItem(getStorageKey(scopeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ReactionCounts>;
    return parsed;
  } catch {
    return {};
  }
}

function saveAll(scopeId: string, data: Record<number | string, ReactionCounts>) {
  try {
    localStorage.setItem(getStorageKey(scopeId), JSON.stringify(data));
  } catch {}
}

export function useExpenseReactions(scopeId: string) {
  const [state, setState] = useState<Record<number | string, ReactionCounts>>(() => loadAll(scopeId));

  useEffect(() => {
    setState(loadAll(scopeId));
  }, [scopeId]);

  const addReaction = useCallback(
    (expenseId: number | string, emoji: ReactionEmoji) => {
      setState((prev) => {
        const next = { ...prev };
        const counts = { ...(next[expenseId] ?? {}) };
        counts[emoji] = (counts[emoji] ?? 0) + 1;
        next[expenseId] = counts;
        saveAll(scopeId, next);
        return next;
      });
    },
    [scopeId]
  );

  const getReactions = useCallback(
    (expenseId: number | string): ReactionCounts => {
      return state[expenseId] ?? {};
    },
    [state]
  );

  const hydrate = useCallback((data: Record<number | string, ReactionCounts>) => {
    setState(data);
    saveAll(scopeId, data);
  }, [scopeId]);

  return { reactionsByExpense: state, addReaction, getReactions, hydrate };
}
