export function getApiBase(): string {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

export function getWsBase(): string {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export function getEventChatWsUrl(eventId: number): string {
  return `${getWsBase()}/ws/events/${eventId}/chat`;
}
