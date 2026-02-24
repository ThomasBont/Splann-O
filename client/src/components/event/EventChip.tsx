"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CHIP_INTERACT, FOCUS_RING_SUBTLE } from "@/lib/ui-utils";

export interface EventChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Optional icon (emoji or element) on the left */
  icon?: React.ReactNode;
  /** Accent hover border from theme */
  accentHover?: boolean;
}

/**
 * Premium chip primitive.
 * Soft borders, subtle hover, press animation.
 */
const EventChip = React.forwardRef<HTMLButtonElement, EventChipProps>(
  ({ className, icon, accentHover = false, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-md)]",
        "border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/50",
        "px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        CHIP_INTERACT,
        FOCUS_RING_SUBTLE,
        "hover:bg-[hsl(var(--surface-2))] hover:text-foreground hover:border-border/80",
        accentHover && "hover:border-primary/30",
        "transition-smooth",
        className
      )}
      {...props}
    >
      {icon && <span className="text-xs leading-none opacity-80" aria-hidden>{icon}</span>}
      {children}
    </button>
  )
);
EventChip.displayName = "EventChip";

export { EventChip };
