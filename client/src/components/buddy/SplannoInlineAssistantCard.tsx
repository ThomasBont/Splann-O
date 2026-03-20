import { Sparkles } from "lucide-react";
import type { SplannoBuddyAction, SplannoBuddyStat } from "@/lib/splanno-buddy";
import { Button } from "@/components/ui/button";

export function SplannoInlineAssistantCard({
  title = "Splann-O",
  summary,
  stats,
  actions,
  onAction,
}: {
  title?: string;
  summary: string;
  stats?: SplannoBuddyStat[];
  actions?: SplannoBuddyAction[];
  onAction: (action: SplannoBuddyAction) => void;
}) {
  return (
    <div className="rounded-[22px] border border-primary/15 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(255,247,237,0.98))] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:border-primary/20 dark:bg-[linear-gradient(160deg,rgba(36,36,40,0.96),rgba(53,40,20,0.72))]">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="text-sm font-semibold text-foreground">A small nudge</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-foreground/92">{summary}</p>
      {stats && stats.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.slice(0, 3).map((stat) => (
            <span
              key={`${stat.label}-${stat.value}`}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              <span>{stat.label}</span>
              <span className="text-foreground">{stat.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.slice(0, 3).map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant === "secondary" ? "outline" : "default"}
              className={action.variant === "primary" ? "bg-primary text-slate-900 hover:bg-primary/90" : "rounded-full"}
              onClick={() => onAction(action)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
