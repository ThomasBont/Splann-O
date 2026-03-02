function getApiBaseOrigin(): string | null {
  const envBase = (import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? "").trim();
  if (!envBase) return null;
  try {
    return new URL(envBase).origin;
  } catch {
    return null;
  }
}

export function resolveAssetUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed;
  const origin = getApiBaseOrigin() || (typeof window !== "undefined" ? window.location.origin : null);
  if (!origin) return trimmed;
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return new URL(normalizedPath, origin).toString();
}

export function withCacheBust(url: string | null | undefined, version: string | number | null | undefined): string | null {
  const resolved = resolveAssetUrl(url);
  if (!resolved || version == null || version === "") return resolved;
  try {
    const parsed = new URL(resolved);
    parsed.searchParams.set("v", String(version));
    return parsed.toString();
  } catch {
    return resolved;
  }
}

