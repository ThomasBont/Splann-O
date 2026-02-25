type PublicListingLike = {
  publicListingStatus?: string | null;
  publicListingExpiresAt?: Date | null;
};

export function isPublicListingActive(event: PublicListingLike): boolean {
  if (event.publicListingStatus !== "active") return false;
  if (!event.publicListingExpiresAt) return false;
  return event.publicListingExpiresAt.getTime() > Date.now();
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
