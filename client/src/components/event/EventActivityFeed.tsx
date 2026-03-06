"use client";

import type { ActivityItem } from "@/utils/eventActivity";

/** Format relative time: "Just now" (< 60s), "5m ago", "2h ago", "Yesterday", "24 Feb" */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1_000);
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface EventActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  /** Optional: for i18n of "Recent activity" */
  title?: string | null;
  className?: string;
}

/**
 * Reusable activity feed. Can be used in Expenses tab or future Chat tab.
 */
export function EventActivityFeed({
  items,
  maxItems = 10,
  title = "Recent activity",
  className = "",
}: EventActivityFeedProps) {
  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) return null;

  return (
    <div className={className}>
      {title ? (
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
      ) : null}
      <ul className="space-y-0 divide-y divide-border/50">
        {displayItems.map((item) => (
          <li
            key={item.id}
            className="mx-[-0.25rem] flex items-start gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] text-sm"
              aria-hidden
            >
              {item.icon ?? "•"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{item.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRelativeTime(item.timestamp)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
