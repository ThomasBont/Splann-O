"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { motionTokens } from "@/lib/motion";

interface AnimatedBalanceProps {
  value: number;
  format: (n: number) => string;
  className?: string;
  reducedMotion?: boolean;
  /** Show green glow when value is ~0 */
  glowWhenZero?: boolean;
}

export function AnimatedBalance({
  value,
  format,
  className,
  reducedMotion = false,
  glowWhenZero = false,
}: AnimatedBalanceProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef({ value: displayValue, time: 0 });

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      return;
    }
    const startValue = displayValue;
    const endValue = value;
    if (startValue === endValue) return;

    startRef.current = { value: startValue, time: performance.now() };

    const tick = (now: number) => {
      const elapsed = now - startRef.current.time;
      const t = Math.min(1, elapsed / motionTokens.numberCount);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const current = startRef.current.value + (endValue - startRef.current.value) * eased;
      setDisplayValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, reducedMotion]);

  const isZero = Math.abs(value) < 0.01;
  const showGlow = glowWhenZero && isZero;

  return (
    <span
      className={cn(
        "tabular-nums transition-shadow duration-300",
        showGlow && "text-green-500 dark:text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)]",
        className
      )}
    >
      {format(displayValue)}
    </span>
  );
}
