type ExpenseMetadata = {
  type?: unknown;
  expenseId?: unknown;
  action?: unknown;
  resolutionMode?: unknown;
  linkedSettlementRoundId?: unknown;
};

type MessageLike = {
  type?: unknown;
  createdAt?: string;
  metadata?: Record<string, unknown> | null;
};

const DEDUPE_WINDOW_MS = 5_000;

function toExpenseDedupeKey(message: MessageLike): string | null {
  if (message.type !== "system") return null;
  const metadata = (message.metadata ?? null) as ExpenseMetadata | null;
  if (!metadata || metadata.type !== "expense") return null;

  const expenseId = typeof metadata.expenseId === "number"
    ? metadata.expenseId
    : Number(metadata.expenseId);
  if (!Number.isFinite(expenseId)) return null;

  const action = String(metadata.action ?? "").trim();
  if (!action) return null;

  return `${expenseId}:${action}`;
}

function toTimestampMs(value?: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function toExpenseSettlementLink(message: MessageLike): { settlementId: string; createdAtMs: number } | null {
  if (message.type !== "system") return null;
  const metadata = (message.metadata ?? null) as ExpenseMetadata | null;
  if (!metadata || metadata.type !== "expense" || metadata.action !== "added") return null;
  const resolutionMode = String(metadata.resolutionMode ?? "").trim().toLowerCase();
  const settlementId = String(metadata.linkedSettlementRoundId ?? "").trim();
  const createdAtMs = toTimestampMs(message.createdAt);
  if (resolutionMode !== "now" || !settlementId || createdAtMs == null) return null;
  return { settlementId, createdAtMs };
}

function isDirectSplitSettlementStart(message: MessageLike): { settlementId: string; createdAtMs: number } | null {
  if (message.type !== "system") return null;
  const metadata = message.metadata ?? null;
  if (!metadata || metadata.type !== "settlement") return null;
  const action = String(metadata.action ?? "").trim().toLowerCase();
  const roundType = String(metadata.roundType ?? "").trim().toLowerCase();
  const settlementId = String(metadata.settlementRoundId ?? metadata.settlementId ?? "").trim();
  const createdAtMs = toTimestampMs(message.createdAt);
  if (action !== "started" || roundType !== "direct_split" || !settlementId || createdAtMs == null) return null;
  return { settlementId, createdAtMs };
}

/**
 * Dedupes historical duplicate expense system messages posted within 5 seconds.
 * Keeps earliest/first chronologically encountered message for the same `${expenseId}:${action}` key.
 *
 * Inline cases:
 * - duplicates within 5s collapse to 1
 * - same key 10s apart keep both
 * - different action keep both
 * - missing metadata remains untouched
 */
export function dedupeExpenseSystemMessages<T extends MessageLike>(messages: T[]): T[] {
  const kept = new Map<string, number>();
  const expenseSettlementLinks = messages
    .map((message) => toExpenseSettlementLink(message))
    .filter((entry): entry is { settlementId: string; createdAtMs: number } => !!entry);
  const result: T[] = [];

  for (const message of messages) {
    const directSplitSettlement = isDirectSplitSettlementStart(message);
    if (directSplitSettlement) {
      const hasLinkedExpenseMessage = expenseSettlementLinks.some((entry) => (
        entry.settlementId === directSplitSettlement.settlementId
        && Math.abs(entry.createdAtMs - directSplitSettlement.createdAtMs) <= DEDUPE_WINDOW_MS
      ));
      if (hasLinkedExpenseMessage) {
        continue;
      }
    }

    const key = toExpenseDedupeKey(message);
    if (!key) {
      result.push(message);
      continue;
    }

    const currentTimestamp = toTimestampMs(message.createdAt);
    const previousTimestamp = kept.get(key);
    if (
      currentTimestamp != null
      && previousTimestamp != null
      && currentTimestamp - previousTimestamp <= DEDUPE_WINDOW_MS
      && currentTimestamp >= previousTimestamp
    ) {
      continue;
    }

    if (currentTimestamp != null) {
      kept.set(key, currentTimestamp);
    }
    result.push(message);
  }

  return result;
}
