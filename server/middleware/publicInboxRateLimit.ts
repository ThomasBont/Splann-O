type InboxBucket = { timestamps: number[] };

const perConversationBuckets = new Map<string, InboxBucket>();
const perUserBuckets = new Map<string, InboxBucket>();

function pushAndTrim(bucket: InboxBucket, now: number, windowMs: number) {
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);
}

export function checkPublicInboxRateLimit(input: {
  userId: number;
  conversationId: string;
  approved: boolean;
}): { ok: true } | { ok: false; retryAfterSeconds: number; scope: "conversation" | "hour" } {
  if (input.approved) return { ok: true };
  const now = Date.now();
  const perConversationWindowMs = 10 * 60_000;
  const perHourWindowMs = 60 * 60_000;

  const convKey = `${input.userId}:${input.conversationId}`;
  const convBucket = perConversationBuckets.get(convKey) ?? { timestamps: [] };
  pushAndTrim(convBucket, now, perConversationWindowMs);
  if (convBucket.timestamps.length >= 1) {
    const retryAfter = Math.ceil((convBucket.timestamps[0] + perConversationWindowMs - now) / 1000);
    perConversationBuckets.set(convKey, convBucket);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfter), scope: "conversation" };
  }

  const hourKey = `${input.userId}:public-inbox`;
  const hourBucket = perUserBuckets.get(hourKey) ?? { timestamps: [] };
  pushAndTrim(hourBucket, now, perHourWindowMs);
  if (hourBucket.timestamps.length >= 3) {
    const retryAfter = Math.ceil((hourBucket.timestamps[0] + perHourWindowMs - now) / 1000);
    perUserBuckets.set(hourKey, hourBucket);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfter), scope: "hour" };
  }

  convBucket.timestamps.push(now);
  hourBucket.timestamps.push(now);
  perConversationBuckets.set(convKey, convBucket);
  perUserBuckets.set(hourKey, hourBucket);
  return { ok: true };
}

