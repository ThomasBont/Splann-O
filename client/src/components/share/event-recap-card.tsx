"use client";

import type { RecapCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";
import { getCurrencySymbol } from "@/lib/currencies";
import { cn } from "@/lib/utils";

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
      <div className={cn("h-1.5 w-full opacity-80 rounded-full", stripClass)} aria-hidden />
      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {data.eventName}
          </h2>
        </div>
        {data.participantNames && data.participantNames.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            {data.participantNames.slice(0, 6).map((name, i) => {
              const initials = name.trim().split(/\s/).map((s) => s[0]).join("").toUpperCase().slice(0, 2) || "?";
              const hues = [35, 330, 160, 210, 270, 50];
              const h = hues[i % hues.length];
              return (
                <div
                  key={i}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${h}, 65%, 50%), hsl(${h}, 70%, 38%))`,
                  }}
                >
                  {initials}
                </div>
              );
            })}
          </div>
        )}
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
