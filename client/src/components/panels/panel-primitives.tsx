import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: {
  label: string;
  title: string;
  meta?: ReactNode;
}) {
  const { closePanel } = usePanel();

  return (
    <div className="flex items-start justify-between gap-4 border-b border-[hsl(var(--border-subtle))] px-5 py-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {meta ? (
          <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
            {meta}
          </div>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={closePanel}
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </Button>
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
      variant === "default" && "bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]",
      variant === "quiet" && "bg-[hsl(var(--surface-2))] p-4 shadow-none",
      variant === "dashboard" && "rounded-3xl bg-[linear-gradient(145deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-5 shadow-[var(--shadow-md)]",
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
    <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--surface-1))]/95 backdrop-blur-md">
      {children}
    </div>
  );
}
