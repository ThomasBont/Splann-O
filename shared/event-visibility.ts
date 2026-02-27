export type EventVisibilityShape = {
  visibilityOrigin?: string | null;
};

export function isPublicEvent(event: EventVisibilityShape | null | undefined): boolean {
  if (!event) return false;
  return event.visibilityOrigin === "public";
}

export function isPrivateEvent(event: EventVisibilityShape | null | undefined): boolean {
  return !isPublicEvent(event);
}
