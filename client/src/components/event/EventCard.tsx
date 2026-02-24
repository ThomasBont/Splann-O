"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EventCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** surface-1 (default) | surface-2 for raised */
  variant?: "default" | "raised";
}

/**
 * Premium card primitive.
 * Uses surface-1, subtle border, light shadow.
 */
const EventCard = React.forwardRef<HTMLDivElement, EventCardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]",
        "shadow-[var(--shadow-sm)]",
        variant === "raised" && "bg-[hsl(var(--surface-2))] shadow-[var(--shadow-md)]",
        "transition-smooth",
        className
      )}
      {...props}
    />
  )
);
EventCard.displayName = "EventCard";

export { EventCard };
