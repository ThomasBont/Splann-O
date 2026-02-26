"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getEventTheme, getEventThemeStyle } from "@/lib/eventTheme";

export interface EventCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** surface-1 (default) | surface-2 for raised */
  variant?: "default" | "raised";
  themeCategory?: string | null;
}

/**
 * Premium card primitive.
 * Uses surface-1, subtle border, light shadow.
 */
const EventCard = React.forwardRef<HTMLDivElement, EventCardProps>(
  ({ className, variant = "default", themeCategory, style, ...props }, ref) => {
    const theme = getEventTheme(themeCategory);
    return (
    <div
      ref={ref}
      style={{ ...getEventThemeStyle(themeCategory), ...style }}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]",
        "shadow-[var(--shadow-sm)]",
        variant === "raised" && "bg-[hsl(var(--surface-2))] shadow-[var(--shadow-md)]",
        themeCategory && theme.classes.surface,
        "transition-smooth",
        className
      )}
      {...props}
    />
  )}
);
EventCard.displayName = "EventCard";

export { EventCard };
