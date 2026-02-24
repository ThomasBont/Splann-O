/**
 * Premium Animations Pack — motion tokens and utilities.
 * Works with Framer Motion; respects prefers-reduced-motion.
 */

export { useReducedMotion } from "framer-motion";

/** Motion timing tokens (ms) */
export const motionTokens = {
  fast: 120,
  normal: 180,
  slow: 220,
  /** Animated number counting (e.g. balance) */
  numberCount: 400,
  /** CSS easing for enter/expand */
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  /** CSS easing for exit/collapse */
  easeIn: "cubic-bezier(0.7, 0, 0.84, 0)",
  /** General purpose */
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

/** Framer Motion transition presets using motionTokens */
export const motionTransition = {
  fast: { duration: motionTokens.fast / 1000, ease: "easeOut" as const },
  normal: { duration: motionTokens.normal / 1000, ease: "easeOut" as const },
  slow: { duration: motionTokens.slow / 1000, ease: "easeOut" as const },
} as const;

/** Tailwind-compatible transition classes respecting reduced motion */
export const motionClass = {
  /** Standard enter transition */
  transition: "transition-all duration-[180ms] ease-out",
  /** Fast transition */
  transitionFast: "transition-all duration-[120ms] ease-out",
  /** Hover: subtle lift + shadow (no bounce) */
  hoverLift: "hover:-translate-y-px hover:shadow-md",
  /** Active: press down + slight scale */
  activePress: "active:translate-y-0 active:scale-[0.98]",
  /** Combined hover + active for pressables */
  pressable: "transition-all duration-[180ms] ease-out hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.98]",
} as const;
