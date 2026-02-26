"use client";

import { cn } from "@/lib/utils";
import { getEventTheme, getEventThemeStyle } from "@/lib/eventTheme";

type Props = {
  category: string | null | undefined;
  className?: string;
  compact?: boolean;
  showTone?: boolean;
};

export function EventCategoryBadge({ category, className, compact = false, showTone = false }: Props) {
  const theme = getEventTheme(category);
  const Icon = theme.icon;
  return (
    <span
      style={getEventThemeStyle(category)}
      className={cn(
        "inline-flex items-center rounded-full border text-[11px] font-medium",
        compact ? "gap-1 px-2 py-0.5" : "gap-1.5 px-2.5 py-1",
        theme.classes.badge,
        className
      )}
    >
      <Icon className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", theme.classes.icon)} />
      <span>{theme.label}</span>
      {showTone && <span className="opacity-70 capitalize">· {theme.tone}</span>}
    </span>
  );
}
