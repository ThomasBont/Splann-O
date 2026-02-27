export const COUNTRY_CODE_ERROR = "countryCode must be ISO-3166-1 alpha-2 (2 chars)";

export function normalizeCountryCode(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/^country\./i, "").toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}

