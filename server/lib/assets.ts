export function resolveLegacyAssetIdToPublicPath(assetId?: string | null): string | null {
  if (!assetId) return null;
  const trimmed = assetId.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("avatar-")) return `/uploads/avatars/${encodeURIComponent(trimmed)}`;
  if (trimmed.startsWith("event-")) return `/uploads/event-banners/${encodeURIComponent(trimmed)}`;
  return `/api/assets/${encodeURIComponent(trimmed)}`;
}

function isLegacyLocalUploadPath(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith("/uploads/");
}

export function resolveUserAvatarUrl(input: {
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  avatarAssetId?: string | null;
}): string | null {
  const assetUrl = resolveLegacyAssetIdToPublicPath(input.avatarAssetId);

  // Prefer the asset-backed URL when an older local upload path is still stored.
  if (assetUrl && (isLegacyLocalUploadPath(input.avatarUrl) || isLegacyLocalUploadPath(input.profileImageUrl))) {
    return assetUrl;
  }

  if (input.avatarUrl) return input.avatarUrl;
  if (input.profileImageUrl) return input.profileImageUrl;
  return assetUrl;
}
