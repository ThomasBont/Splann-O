import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";

export function useActiveEventId() {
  const [location] = useLocation();
  const match = location.match(/^\/app\/e\/(\d+)(?:\/|$)/);
  if (!match) return null;
  const eventId = Number(match[1]);
  return Number.isFinite(eventId) && eventId > 0 ? eventId : null;
}

export function formatPanelDate(value: string | Date | null | undefined) {
  if (!value) return "Date TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBD";
  return date.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPanelLocation(plan: {
  locationText?: string | null;
  locationName?: string | null;
  city?: string | null;
  countryName?: string | null;
} | null | undefined) {
  return plan?.locationText
    ?? plan?.locationName
    ?? [plan?.city, plan?.countryName].filter(Boolean).join(", ")
    ?? "Location TBD";
}

export function PanelHeader({
  label,
  title,
  meta,
  actions,
}: {
  label?: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const isMobile = useIsMobile();
  const { panel, closePanel, replacePanel } = usePanel();
  const showBackButton = !!panel && panel.type !== "overview";
  const backTarget = (panel?.type === "member-profile" && panel.source === "crew")
    || (panel?.type === "invite" && panel.source === "crew")
    ? { label: "Crew", panel: { type: "crew" } as const }
    : panel?.type === "add-expense" && panel.source === "expenses"
      ? { label: "Expenses", panel: { type: "expenses" } as const }
    : panel?.type === "add-poll" && panel.source === "polls"
      ? { label: "Votes", panel: { type: "polls" } as const }
    : { label: "Overview", panel: { type: "overview" } as const };

  return (
    <div className={cn("rounded-t-[inherit] border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-5 py-5", isMobile && "px-3.5 py-2.5")}>
      <div className={cn("flex items-center justify-between gap-4", isMobile && "gap-2.5")}>
        <div className="min-w-0">
          {showBackButton ? (
            <button
              type="button"
              onClick={() => replacePanel(backTarget.panel)}
              className={cn(
                "inline-flex items-center text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isMobile && "text-[13px]",
              )}
            >
              ← {backTarget.label}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isMobile && "h-[30px] w-[30px] rounded-full",
            )}
            onClick={closePanel}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className={cn("min-w-0", showBackButton ? (isMobile ? "mt-1.5" : "mt-3") : "mt-0")}>
        {label ? (
          <p className={cn("text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground", isMobile && "text-[10px] tracking-[0.18em]")}>{label}</p>
        ) : null}
        <h2 className={cn("truncate text-xl font-semibold tracking-tight text-foreground", isMobile ? "text-[17px]" : "text-xl", label ? "mt-0.5" : "mt-0")}>{title}</h2>
        {meta ? (
          <div className={cn("mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground", isMobile && "mt-1.5 gap-0.5 text-[12px] leading-[1.15rem]")}>
            {meta}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PanelSection({
  title,
  children,
  variant = "default",
  className,
}: {
  title: string;
  children: ReactNode;
  variant?: "default" | "quiet" | "dashboard" | "list" | "ledger" | "workflow";
  className?: string;
}) {
  return (
    <section className={cn(
      "rounded-2xl border border-[hsl(var(--border-subtle))]",
      variant === "default" && "bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)] md:p-4",
      variant === "quiet" && "bg-[hsl(var(--surface-2))] p-4 shadow-none md:p-4",
      variant === "dashboard" && "rounded-3xl bg-[linear-gradient(145deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-5 shadow-[var(--shadow-md)] md:p-5",
      variant === "list" && "bg-[hsl(var(--surface-1))] p-3.5 shadow-none",
      variant === "ledger" && "bg-[hsl(var(--surface-1))] p-3.5 shadow-none",
      variant === "workflow" && "bg-[linear-gradient(180deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-4 shadow-[var(--shadow-sm)]",
      className,
    )}>
      <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PanelShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[inherit] bg-transparent">
      {children}
    </div>
  );
}

export function panelHeaderAddButtonClass() {
  return "h-10 rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90";
}
