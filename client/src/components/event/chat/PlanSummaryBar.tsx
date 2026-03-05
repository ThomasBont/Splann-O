import { Calendar, ChevronRight, MapPin, Users, Wallet } from "lucide-react";

type PlanSummaryBarProps = {
  location: string | null;
  dateTime: Date | string | null;
  participantCount: number;
  sharedTotal: number;
  currency: string;
  onClick?: () => void;
};

function formatDateTime(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const datePart = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const timePart = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${datePart} · ${timePart}`;
}

function formatCurrency(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      const formatted = new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: code,
        maximumFractionDigits: 2,
      }).format(safeAmount);
      // Normalize narrow-chat presentation by removing a space between symbol and value (e.g. "€ 43,00" -> "€43,00").
      return formatted.replace(/([^\d\s])\s+(?=\d)/, "$1");
    } catch {
      // fall through to symbol/prefix fallback
    }
  }
  const prefix = currency || "€";
  return `${prefix}${safeAmount.toFixed(2)}`;
}

export function PlanSummaryBar({
  location,
  dateTime,
  participantCount,
  sharedTotal,
  currency,
  onClick,
}: PlanSummaryBarProps) {
  const items: Array<{ key: string; icon: JSX.Element; label: string }> = [];
  if (location && location.trim()) {
    items.push({
      key: "location",
      icon: <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />,
      label: location.trim(),
    });
  }

  const formattedDate = formatDateTime(dateTime);
  if (formattedDate) {
    items.push({
      key: "date",
      icon: <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />,
      label: formattedDate,
    });
  }

  items.push({
    key: "people",
    icon: <Users className="h-3.5 w-3.5 text-muted-foreground/70" />,
    label: `${participantCount} ${participantCount === 1 ? "person" : "people"}`,
  });

  items.push({
    key: "shared",
    icon: <Wallet className="h-3.5 w-3.5 text-muted-foreground/70" />,
    label: `${formatCurrency(sharedTotal, currency)} shared`,
  });

  return (
    <div
      className="sticky top-0 z-10 w-full cursor-pointer border-b border-border/70 bg-background/80 px-3 py-2 text-sm backdrop-blur transition-colors hover:bg-muted/50"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      aria-label={onClick ? "Open plan details" : undefined}
    >
      <div className="flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-1">
          {items.map((item) => (
            <div key={item.key} className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              {item.icon}
              <span className={`truncate font-medium ${item.key === "location" || item.key === "date" ? "text-foreground" : "text-foreground/75"}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
      </div>
    </div>
  );
}

export default PlanSummaryBar;
