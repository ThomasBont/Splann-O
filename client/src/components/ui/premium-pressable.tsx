"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { motionTransition } from "@/lib/motion";

export interface PremiumPressableProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Render as button when true (default: div) */
  asChild?: boolean;
  /** Disable interaction styles */
  disabled?: boolean;
  /** Optional className for the motion wrapper */
  motionClassName?: string;
}

/**
 * Standardizes hover/press behavior across buttons, cards, chips.
 * - hover: translateY(-1px), subtle shadow
 * - active: translateY(0) + scale(0.98)
 * - respects prefers-reduced-motion (fade only)
 */
export const PremiumPressable = React.forwardRef<HTMLDivElement, PremiumPressableProps>(
  ({ children, asChild, disabled, className, motionClassName, ...props }, ref) => {
    const reduceMotion = useReducedMotion();

    const motionProps = reduceMotion
      ? {}
      : {
          whileHover: disabled ? undefined : { y: -1 },
          whileTap: disabled ? undefined : { y: 0, scale: 0.98 },
          transition: motionTransition.fast,
        };

    const Comp = asChild ? motion.span : motion.div;

    return (
      <Comp
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          "inline-flex items-center justify-center",
          !reduceMotion && !disabled && "cursor-pointer",
          disabled && "opacity-50 pointer-events-none",
          motionClassName,
          className
        )}
        {...motionProps}
        {...(props as Record<string, unknown>)}
      >
        {children}
      </Comp>
    );
  }
);
PremiumPressable.displayName = "PremiumPressable";
