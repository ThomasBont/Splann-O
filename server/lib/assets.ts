export function resolveLegacyAssetIdToPublicPath(assetId?: string | null): string | null {
  if (!assetId) return null;
  const trimmed = assetId.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("avatar-")) return `/uploads/avatars/${encodeURIComponent(trimmed)}`;
  if (trimmed.startsWith("event-")) return `/uploads/event-banners/${encodeURIComponent(trimmed)}`;
  return `/api/assets/${encodeURIComponent(trimmed)}`;
}

