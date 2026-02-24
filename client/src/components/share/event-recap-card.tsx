"use client";

import type { RecapCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";
import { CURRENCIES } from "@/hooks/use-language";
import { cn } from "@/lib/utils";

function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "€";
}

export interface EventRecapCardProps {
  data: RecapCardData;
  theme?: ThemeToken;
  /** Square layout for Instagram (default true). */
  square?: boolean;
  /** For export: use solid background for social compression. */
  exportMode?: boolean;
  className?: string;
}

/** Shareable event recap card. Same visual system as settle card. */
export function EventRecapCard({
  data,
  theme,
  square = true,
  exportMode = false,
  className,
}: EventRecapCardProps) {
  const symbol = getCurrencySymbol(data.currency);
  const stripClass =
    theme?.header?.stripGradientClass ??
    "bg-gradient-to-r from-orange-500/70 via-amber-500/60 to-orange-600/70";
  const cardBg = exportMode
    ? "bg-[#1a1a1e]"
    : "bg-gradient-to-br from-[#1a1a1e] via-[#252530] to-[#1a1a1e]";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 shadow-xl",
        cardBg,
        square && "aspect-square flex flex-col",
        className
      )}
      data-share-card="recap"
    >
      <div className={cn("h-1.5 w-full opacity-80", stripClass)} aria-hidden />
      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {data.eventName}
          </h2>
        </div>
        <div className="mt-4 space-y-2">
          <p className="text-xl font-bold text-white">
            {symbol}
            {data.totalSpent.toFixed(2)} total spent
          </p>
          <p className="text-sm text-white/70">
            {data.participantCount} participant
            {data.participantCount !== 1 ? "s" : ""} · {data.expenseCount} expense
            {data.expenseCount !== 1 ? "s" : ""}
          </p>
          {data.funStat && (
            <p className="text-sm font-medium text-white/90 mt-2">
              {data.funStat.label}: {data.funStat.value}
            </p>
          )}
        </div>
        <footer className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/50 font-medium tracking-wide">
            Split smart with Splanno
          </p>
        </footer>
      </div>
    </div>
  );
}
