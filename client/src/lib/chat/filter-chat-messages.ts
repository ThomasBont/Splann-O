type MessageLike = {
  type?: unknown;
  text?: string;
  metadata?: Record<string, unknown> | null;
};

const LEGACY_EXPENSE_ACTION_RE = /\b(?:added|updated|deleted)\s+an\s+expense:/i;
const LEGACY_EXPENSE_AMOUNT_RE = /\([^)]*(?:€|EUR|USD|GBP|CAD|AUD|CHF|SEK|NOK|DKK|JPY)[^)]*\d[^)]*\)/i;

/**
 * Legacy cleanup after introducing structured expense metadata cards.
 * We suppress only high-confidence old plain-text expense system messages.
 *
 * Inline cases:
 * - system + "added an expense: X (EUR14.00)" + no metadata => true
 * - system + "Alice joined the plan" => false
 * - system + metadata.type === "expense" => false
 * - random system text => false
 */
export function isLegacyExpenseSystemMessage(message: MessageLike): boolean {
  if (message.type !== "system") return false;
  const metadataType = String((message.metadata as { type?: unknown } | null)?.type ?? "").trim().toLowerCase();
  if (metadataType === "expense") return false;

  const text = String(message.text ?? "").trim();
  if (!text) return false;
  if (!LEGACY_EXPENSE_ACTION_RE.test(text)) return false;
  if (!LEGACY_EXPENSE_AMOUNT_RE.test(text)) return false;
  return true;
}

export function filterChatMessages<T extends MessageLike>(messages: T[]): T[] {
  return messages.filter((message) => !isLegacyExpenseSystemMessage(message));
}

