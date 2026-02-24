"use client";

import type { SettleCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";
import { getCurrencySymbol } from "@/lib/currencies";
import { cn } from "@/lib/utils";

export interface SettleCardProps {
  data: SettleCardData;
  theme?: ThemeToken;
  /** Square layout for Instagram (default true). */
  square?: boolean;
  /** For export: use solid background for social compression. */
  exportMode?: boolean;
  /** Show "Made with Splanno" watermark (Free plan). */
  showWatermark?: boolean;
  className?: string;
}

/** Reusable shareable settle card. Premium dark theme, event accent. */
export function SettleCard({
  data,
  theme,
  square = true,
  exportMode = false,
  showWatermark = false,
  className,
}: SettleCardProps) {
  const s = data.settlements[0];
  const accentBg = theme?.accent.bg ?? "bg-orange-500/15 dark:bg-orange-500/20";
  const stripClass =
    theme?.header?.stripGradientClass ??
    "bg-gradient-to-r from-orange-500/70 via-amber-500/60 to-orange-600/70";
  const cardBg = exportMode
    ? "bg-[#1a1a1e]"
    : "bg-gradient-to-br from-[#1a1a1e] via-[#252530] to-[#1a1a1e]";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 shadow-xl relative",
        cardBg,
        square && "aspect-square flex flex-col",
        className
      )}
      data-share-card="settle"
    >
      {/* Accent strip */}
      <div className={cn("h-1.5 w-full opacity-80", stripClass)} aria-hidden />
      <div className="flex flex-1 flex-col justify-between p-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {data.eventName}
          </h2>
          {data.subtitle && (
            <p className="mt-1 text-sm text-white/60">{data.subtitle}</p>
          )}
        </div>
        <div className="mt-6">
          {s && (
            <p className="text-xl font-semibold text-white leading-snug">
              <span className="text-red-400">{s.from}</span>
              <span className="mx-2 text-white/60">owes</span>
              <span className="text-green-400">{s.to}</span>
              <span className="ml-2 text-white font-bold">
                {getCurrencySymbol(data.currency)}
                {s.amount.toFixed(2)}
              </span>
            </p>
          )}
        </div>
        <footer className="mt-6 pt-4 border-t border-white/10">
          <p className="text-xs text-white/50 font-medium tracking-wide">
            Settled with Splanno
          </p>
        </footer>
      </div>
      {showWatermark && (
        <div
          className="absolute bottom-2 right-2 text-[10px] text-white/40 font-medium tracking-wide"
          aria-hidden
        >
          Made with Splanno
        </div>
      )}
    </div>
  );
}
