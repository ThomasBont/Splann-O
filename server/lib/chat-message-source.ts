export type ChatMessageSource = "app" | "telegram";

export function getChatMessageSource(metadata: Record<string, unknown> | null | undefined): ChatMessageSource | null {
  const source = String((metadata as { source?: unknown } | null)?.source ?? "").trim().toLowerCase();
  if (source === "app" || source === "telegram") return source;
  return null;
}

export function ensureAppMessageSource(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const base = metadata && typeof metadata === "object" ? { ...metadata } : {};
  return {
    ...base,
    source: "app",
  };
}
