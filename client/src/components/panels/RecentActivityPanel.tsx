import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlanActivity } from "@/hooks/use-plan-activity";
import { usePlan } from "@/hooks/use-plan-data";
import { formatActivityPreview, formatActivityTime } from "@/components/panels/activity-format";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

export function RecentActivityPanel() {
  const eventId = useActiveEventId();
  const planQuery = usePlan(eventId);
  const { items, loading, unreadCount, highlightedId, markAllAsRead } = usePlanActivity(eventId, !!eventId);
  const currency = typeof planQuery.data?.currency === "string" ? planQuery.data.currency : "EUR";

  return (
    <PanelShell>
      <PanelHeader title="Recent activity" />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            No activity yet.
          </div>
        ) : (
          <PanelSection title="Recent activity" variant="list">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" disabled={unreadCount <= 0} onClick={() => { void markAllAsRead(); }}>
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Mark all as read
              </Button>
            </div>
            <ul className="space-y-2">
              {items.map((activity) => (
                <li
                  key={`recent-activity-${activity.id}`}
                  className={`rounded-xl border border-border/60 bg-background/70 px-3 py-2 ${highlightedId === activity.id ? "ring-1 ring-primary/50" : ""}`}
                >
                  <p className="text-sm text-foreground">{formatActivityPreview(activity, currency)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(activity.actorName || "Someone")}{activity.createdAt ? ` · ${formatActivityTime(activity.createdAt)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </PanelSection>
        )}
      </div>
    </PanelShell>
  );
}

export default RecentActivityPanel;
