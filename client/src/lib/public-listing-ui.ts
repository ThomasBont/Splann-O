import { isPublicEvent as isCanonicalPublicEvent } from "@shared/event-visibility";

type PublicListingBadgeEvent = {
  visibility?: string | null;
  visibilityOrigin?: string | null;
  publicListingStatus?: string | null;
  status?: string | null;
};

export function isPublicEvent(event: PublicListingBadgeEvent | null | undefined): boolean {
  return isCanonicalPublicEvent(event);
}

export function isPublicIntentEvent(event: PublicListingBadgeEvent | null | undefined): boolean {
  return isPublicEvent(event);
}

export function shouldShowPendingPublish(event: PublicListingBadgeEvent | null | undefined): boolean {
  if (!event) return false;
  if (!isPublicEvent(event)) return false;
  if (event.visibility === "public") return false;

  const listingStatus = event.publicListingStatus ?? null;
  if (listingStatus === "active" || listingStatus === "paused") return false;
  if (listingStatus === "inactive" || listingStatus === "expired") return true;

  return (event.status ?? null) === "draft";
}

export function getListingBadgeLabel(event: PublicListingBadgeEvent | null | undefined): string | null {
  return shouldShowPendingPublish(event) ? "Pending publish" : null;
}
