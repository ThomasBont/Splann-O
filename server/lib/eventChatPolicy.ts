type EventLike = {
  date?: Date | string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getEventChatCutoffAt(eventDate: Date | string | null | undefined): Date | null {
  if (!eventDate) return null;
  const parsed = eventDate instanceof Date ? eventDate : new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const endOfEventDayUtc = new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    23, 59, 59, 999,
  ));
  return new Date(endOfEventDayUtc.getTime() + DAY_MS);
}

export function isEventChatLocked(event: EventLike, now = new Date()): boolean {
  const cutoffAt = getEventChatCutoffAt(event.date ?? null);
  if (!cutoffAt) return false;
  return now.getTime() > cutoffAt.getTime();
}

