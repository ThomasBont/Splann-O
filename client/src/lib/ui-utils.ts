/**
 * Premium SaaS UI utilities.
 * Transitions, focus ring, and micro-interaction classes.
 * Aligned with motion.ts tokens for consistency.
 */

import { cn } from "./utils";
import { motionClass } from "./motion";

/** Standard transition (180ms) */
export const TRANSITION_SMOOTH = motionClass.transition;

/** Fast transition (120ms) */
export const TRANSITION_FAST = motionClass.transitionFast;

/** Focus ring for buttons and interactive elements */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Subtle focus ring for chips and compact elements */
export const FOCUS_RING_SUBTLE = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1";

/** Button micro-interactions: hover lift, active press */
export const BTN_INTERACT = motionClass.pressable;

/** Chip micro-interactions: subtle press */
export const CHIP_INTERACT = cn(motionClass.transitionFast, "active:scale-[0.98]");
