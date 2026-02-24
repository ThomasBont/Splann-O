/**
 * Lightweight event activity feed.
 * Derives system messages from existing event data (no new DB tables).
 * Reusable for Expenses tab and future Chat tab.
 */

export type ActivityItemType = "expense" | "join" | "system";

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  message: string;
  timestamp: Date;
  icon?: string;
}

export interface EventActivityInput {
  event: {
    id: number;
    name: string;
    date: Date | string;
    currency?: string;
    creatorId?: string | null;
  };
  expenses: Array<{
    id: number;
    item: string;
    amount: number | string;
    participantName?: string;
  }>;
  participants: Array<{
    id: number;
    name: string;
    userId?: string | null;
  }>;
  /** Display name for creator (e.g. from users table). Falls back to creatorId if omitted. */
  creatorDisplayName?: string | null;
}

/**
 * Generate chronological activity items from existing event data.
 * Uses creation order (event → joins by id → expenses by id) to assign timestamps
 * spread relative to "now", so each activity shows a sensible relative time.
 */
export function getEventActivity(input: EventActivityInput): ActivityItem[] {
  const { event, expenses, participants, creatorDisplayName } = input;
  const items: ActivityItem[] = [];

  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  // 1. Event created (oldest)
  const creatorName = creatorDisplayName || event.creatorId || "Someone";
  items.push({
    id: `event-${event.id}`,
    type: "system",
    message: `${creatorName} created this event`,
    timestamp: new Date(0),
    icon: "⚙️",
  });

  // 2. User joined — participants with userId, ordered by id (lower id = joined earlier)
  participants
    .filter((p) => p.userId)
    .sort((a, b) => a.id - b.id)
    .forEach((p) => {
      items.push({
        id: `join-${p.id}`,
        type: "join",
        message: `${p.name} joined the event`,
        timestamp: new Date(0),
        icon: "👋",
      });
    });

  // 3. Expenses added — order by id (higher id = more recent)
  const sortedExpenses = [...expenses].sort((a, b) => a.id - b.id);
  sortedExpenses.forEach((exp) => {
    items.push({
      id: `expense-${exp.id}`,
      type: "expense",
      message: `${exp.participantName ?? "Someone"} added an expense: ${exp.item} ${exp.amount}`,
      timestamp: new Date(0),
      icon: "💸",
    });
  });

  // Assign timestamps spread from "oldest" to "newest" relative to now
  // Oldest = 2 days ago, Newest = 30 seconds ago (so we never get future dates)
  const total = items.length;
  const oldestMs = now - 2 * MS_PER_DAY;
  const newestMs = now - 30_000; // 30 seconds ago
  items.forEach((item, idx) => {
    const t = total <= 1 ? 0 : idx / (total - 1);
    const ts = oldestMs + t * (newestMs - oldestMs);
    item.timestamp = new Date(ts);
  });

  // Sort newest-first for display
  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return items;
}
