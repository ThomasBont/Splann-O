import { useMemo } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PlanActivityItem } from "@/hooks/use-plan-activity";

function formatRelativeTimestamp(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) return "";
  const diffMs = Date.now() - time;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

type ActivityDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PlanActivityItem[];
  loading: boolean;
  highlightedId: number | null;
  unreadCount: number;
  onMarkAllAsRead: () => Promise<void>;
};

export default function ActivityDrawer({
  open,
  onOpenChange,
  items,
  loading,
  highlightedId,
  unreadCount,
  onMarkAllAsRead,
}: ActivityDrawerProps) {
  const canMark = unreadCount > 0;
  const titleSuffix = useMemo(() => (unreadCount > 0 ? `(${unreadCount})` : ""), [unreadCount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
            <div className="flex items-center justify-between gap-2">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Recent activity {titleSuffix}</SheetTitle>
                <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">All updates in this plan</SheetDescription>
              </SheetHeader>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3"
                disabled={!canMark}
                onClick={() => {
                  void onMarkAllAsRead();
                }}
              >
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Mark all as read
              </Button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading activity…
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
                <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                No activity yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((activity) => (
                  <li
                    key={`activity-drawer-${activity.id}`}
                    className={`rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900 ${highlightedId === activity.id ? "ring-1 ring-primary/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800 dark:text-neutral-100">{activity.message}</p>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-neutral-400">
                          {(activity.actorName || "Someone")}{activity.createdAt ? ` · ${formatRelativeTimestamp(activity.createdAt)}` : ""}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
