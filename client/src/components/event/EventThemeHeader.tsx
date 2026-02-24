"use client";

import { getEventTheme } from "@/theme/useEventTheme";
import { headerClass } from "@/theme/themeClassnames";
import { cnTheme } from "@/theme/eventThemes";
import type { EventCategory } from "@/theme/eventThemes";
import type { ThemeToken } from "@/theme/eventThemes";

export interface EventThemeHeaderProps {
  category: EventCategory;
  type: string;
  title: string;
  subtitle?: string;
  /** Override theme (e.g. for gallery). If not provided, resolved from category + type. */
  theme?: ThemeToken;
}

/**
 * Themed header for event pages. Renders gradient strip, icon, title, and tagline.
 * Uses theme token classes (Tailwind).
 */
export function EventThemeHeader({
  category,
  type,
  title,
  subtitle,
  theme: themeOverride,
}: EventThemeHeaderProps) {
  const theme = themeOverride ?? getEventTheme(category, type);
  const displaySubtitle = subtitle ?? theme.copy.tagline;

  return (
    <div className={`${headerClass(theme)} overflow-hidden border-border dark:border-white/10`}>
      {/* Theme strip */}
      <div className={cnTheme(theme, "strip") + " h-1.5 w-full opacity-80"} aria-hidden />
      <div className="p-3 flex items-center gap-3">
        <div
          className={cnTheme(theme, "badge") + " flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"}
          aria-hidden
        >
          {theme.icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {theme.label}
          </p>
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {displaySubtitle && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{displaySubtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
