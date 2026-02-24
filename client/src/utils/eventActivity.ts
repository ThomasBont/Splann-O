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
 * Order: event created first, then expenses (newest by id), then joins (by participant id).
 */
export function getEventActivity(input: EventActivityInput): ActivityItem[] {
  const { event, expenses, participants, creatorDisplayName } = input;
  const items: ActivityItem[] = [];

  const eventDate = typeof event.date === "string" ? new Date(event.date) : event.date;

  // Timestamp ordering: event (oldest) → joins → expenses (newest). Display is newest-first.
  const MS_PER_DAY = 86_400_000;
  const eventCreatedAt = new Date(eventDate.getTime() - 2 * MS_PER_DAY);
  const joinBaseAt = new Date(eventDate.getTime() - 1 * MS_PER_DAY);

  // 1. Event created
  const creatorName = creatorDisplayName || event.creatorId || "Someone";
  items.push({
    id: `event-${event.id}`,
    type: "system",
    message: `${creatorName} created this event`,
    timestamp: eventCreatedAt,
    icon: "⚙️",
  });

  // 2. User joined — participants with userId (logged-in users)
  participants
    .filter((p) => p.userId)
    .forEach((p, idx) => {
      items.push({
        id: `join-${p.id}`,
        type: "join",
        message: `${p.name} joined the event`,
        timestamp: new Date(joinBaseAt.getTime() - idx * 60_000),
        icon: "👋",
      });
    });

  // 3. Expenses added — order by id desc (higher id = more recent)
  const sortedExpenses = [...expenses].sort((a, b) => b.id - a.id);
  const expenseBaseAt = new Date(eventDate.getTime());
  sortedExpenses.forEach((exp, idx) => {
    const offset = idx * 60_000;
    items.push({
      id: `expense-${exp.id}`,
      type: "expense",
      message: `${exp.participantName ?? "Someone"} added an expense: ${exp.item} ${exp.amount}`,
      timestamp: new Date(expenseBaseAt.getTime() + offset),
      icon: "💸",
    });
  });

  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return items;
}
