"use client";

import type { ActivityItem } from "@/utils/eventActivity";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export interface EventActivityFeedProps {
  items: ActivityItem[];
  maxItems?: number;
  /** Optional: for i18n of "Recent activity" */
  title?: string;
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
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        {title}
      </h3>
      <ul className="space-y-0 divide-y divide-border/50">
        {displayItems.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 py-2.5 px-1 -mx-1 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <span
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm bg-muted/50"
              aria-hidden
            >
              {item.icon ?? "•"}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90">{item.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatRelativeTime(item.timestamp)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
