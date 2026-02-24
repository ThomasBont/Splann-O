/**
 * Premium SaaS UI utilities.
 * Transitions, focus ring, and micro-interaction classes.
 */

import { cn } from "./utils";

/** 200ms ease-out transition */
export const TRANSITION_SMOOTH = "transition-all duration-200 ease-out";

/** 150ms ease-out transition */
export const TRANSITION_FAST = "transition-all duration-150 ease-out";

/** Focus ring for buttons and interactive elements */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Subtle focus ring for chips and compact elements */
export const FOCUS_RING_SUBTLE = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1";

/** Button micro-interactions: hover lift, active press */
export const BTN_INTERACT = cn(
  TRANSITION_FAST,
  "hover:-translate-y-px active:translate-y-0 active:scale-[0.98]"
);

/** Chip micro-interactions: subtle press */
export const CHIP_INTERACT = cn(TRANSITION_FAST, "active:scale-[0.98]");
