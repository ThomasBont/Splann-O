"use client";

import { type LucideIcon } from "lucide-react";
import type { ThemeToken } from "@/theme/eventThemes";

export interface StatItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Small accent for icon only: primary (yellow), blue, orange, green */
  accent?: "primary" | "blue" | "orange" | "green";
}

const ACCENT_CLASSES: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  blue: "bg-blue-500/15 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400",
  orange: "bg-orange-500/15 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400",
  green: "bg-green-500/15 text-green-500 dark:bg-green-500/20 dark:text-green-400",
};

export interface StatsRowProps {
  stats: StatItem[];
  /** Optional theme token - first stat uses theme accent when provided */
  theme?: ThemeToken;
}

/**
 * Compact stat cards: neutral background, small colored icon badge.
 * When theme is provided, the first stat uses the theme's accent.
 */
export function StatsRow({ stats, theme }: StatsRowProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s, i) => {
        const Icon = s.icon;
        const useThemeAccent = theme && i === 0;
        const accentCls = useThemeAccent
          ? `${theme!.accent.bg} ${theme!.accent.text}`
          : (ACCENT_CLASSES[s.accent ?? "primary"] ?? ACCENT_CLASSES.primary);
        return (
          <div
            key={s.label}
            className="rounded-xl border border-border bg-card p-3 flex items-center gap-3"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentCls}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="text-base font-bold font-display truncate">{s.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
