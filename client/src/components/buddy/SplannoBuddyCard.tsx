import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import type { SplannoBuddyAction, SplannoBuddyIntent, SplannoBuddyStat } from "@/lib/splanno-buddy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getIntentTokens(intent: SplannoBuddyIntent) {
  if (intent === "resolve") {
    return {
      icon: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
      label: "Needs attention",
      border: "border-amber-200/55 dark:border-amber-500/16",
    };
  }
  if (intent === "warn") {
    return {
      icon: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      label: "In progress",
      border: "border-border/70 dark:border-white/10",
    };
  }
  if (intent === "celebrate") {
    return {
      icon: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
      label: "On track",
      border: "border-emerald-200/55 dark:border-emerald-500/16",
    };
  }
  return {
    icon: "bg-primary/10 text-primary",
    label: "Guidance",
    border: "border-border/70 dark:border-white/10",
  };
}

export function SplannoBuddyCard({
  label = "Splann-O",
  title,
  intent = "guide",
  chipLabel,
  summary,
  primaryAttention,
  stats,
  actions,
  onAction,
  openLabel,
  onOpen,
  className,
}: {
  label?: string;
  title?: string;
  intent?: SplannoBuddyIntent;
  chipLabel?: string | null;
  summary: string;
  primaryAttention?: string | null;
  stats?: SplannoBuddyStat[];
  actions?: SplannoBuddyAction[];
  onAction: (action: SplannoBuddyAction) => void;
  openLabel?: string;
  onOpen?: () => void;
  className?: string;
}) {
  const tokens = getIntentTokens(intent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "pointer-events-auto w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border bg-background/95 p-4 shadow-[0_16px_36px_rgba(15,23,42,0.1)] backdrop-blur-xl dark:bg-[hsl(var(--surface-1))]/94",
        tokens.border,
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full", tokens.icon)}>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          {title ? <p className="truncate text-xs text-muted-foreground/80">{title}</p> : null}
        </div>
        {(intent === "resolve" || chipLabel) ? (
          <span className="ml-auto rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
            {chipLabel ?? tokens.label}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[15px] font-medium leading-6 text-foreground/92">{summary}</p>
      {primaryAttention ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{primaryAttention}</p>
      ) : null}
      {stats && stats.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {stats.slice(0, 2).map((stat) => (
            <span
              key={`${stat.label}-${stat.value}`}
              className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
            >
              <span>{stat.label}</span>
              <span className="text-foreground">{stat.value}</span>
            </span>
          ))}
        </div>
      ) : null}
      {onOpen ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>{openLabel ?? "Open assistant"}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {actions.slice(0, 2).map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant === "ghost" ? "ghost" : action.variant === "secondary" ? "outline" : "default"}
              className={cn(
                "h-9 rounded-full px-3.5 text-[13px]",
                action.variant === "primary" && "bg-primary/92 text-slate-900 hover:bg-primary/88",
              )}
              onClick={(event) => {
                event.stopPropagation();
                onAction(action);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
