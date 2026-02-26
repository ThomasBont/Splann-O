type PublicListingLike = {
  publicListingStatus?: string | null;
  publicListingExpiresAt?: Date | null;
  publicListFromAt?: Date | null;
  publicListUntilAt?: Date | null;
};

export function isPublicListingActive(event: PublicListingLike): boolean {
  if (event.publicListingStatus !== "active") return false;
  if (!event.publicListingExpiresAt) return false;
  const now = Date.now();
  if (event.publicListingExpiresAt.getTime() <= now) return false;
  if (event.publicListFromAt && event.publicListFromAt.getTime() > now) return false;
  if (event.publicListUntilAt && event.publicListUntilAt.getTime() <= now) return false;
  return true;
}

export function slugifyPublicEvent(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "event";
}
