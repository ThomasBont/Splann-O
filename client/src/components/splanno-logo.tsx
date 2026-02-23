"use client";

import { cn } from "@/lib/utils";

export type SplannoLogoVariant = "full" | "icon";

export interface SplannoLogoProps {
  /** Logo variant: full (icon + wordmark) or icon-only. */
  variant?: SplannoLogoVariant;
  /** Render height in pixels. Width auto-scales to preserve aspect ratio. */
  size?: number;
  className?: string;
}

/**
 * Splanno logo as inline SVG (transparent background, no white box).
 * Uses CSS variables for theme-aware colors; sits directly on page background.
 */
export function SplannoLogo({
  variant = "icon",
  size = 32,
  className,
}: SplannoLogoProps) {
  const iconSize = variant === "full" ? Math.round(size * 0.85) : size;
  const textSize = Math.round(size * 0.42);

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 shrink-0", className)}
      style={{ height: size }}
      aria-hidden
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Left bubble (blue) */}
        <path
          d="M2 12a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V12z"
          fill="hsl(var(--splanno-blue))"
        />
        {/* Right bubble (orange) */}
        <path
          d="M22 12a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V12z"
          fill="hsl(var(--splanno-orange))"
        />
        <circle cx="10" cy="11" r="1.8" fill="white" fillOpacity="0.6" />
        <circle cx="14" cy="13" r="1.2" fill="white" fillOpacity="0.5" />
        <circle cx="38" cy="11" r="1.8" fill="white" fillOpacity="0.6" />
        <circle cx="34" cy="13" r="1.2" fill="white" fillOpacity="0.5" />
        {/* Calendar / receipt */}
        <rect x="8" y="14" width="12" height="14" rx="1.5" fill="white" />
        <path
          d="M14 26l2 2 4-4"
          stroke="hsl(var(--splanno-blue))"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Dollar */}
        <rect x="28" y="14" width="14" height="18" rx="2" fill="hsl(var(--splanno-green))" />
        <text
          x="35"
          y="26"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="10"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          $
        </text>
        <circle cx="24" cy="5" r="2" fill="hsl(var(--splanno-purple))" />
        <circle cx="28" cy="6" r="1.4" fill="hsl(var(--splanno-purple))" />
        <circle cx="25" cy="42" r="1.4" fill="hsl(var(--splanno-purple))" />
      </svg>
      {variant === "full" && (
        <span
          className="font-semibold tracking-tight lowercase shrink-0"
          style={{
            fontSize: textSize,
            lineHeight: 1,
            color: "hsl(var(--splanno-text))",
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          splanno
        </span>
      )}
    </span>
  );
}
