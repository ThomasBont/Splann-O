"use client";

import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: { icon: 20, text: "text-sm" },
  md: { icon: 24, text: "text-base" },
  lg: { icon: 32, text: "text-xl" },
  xl: { icon: 64, text: "text-3xl" },
  "2xl": { icon: 96, text: "text-4xl" },
} as const;

export type SplannoLogoSize = keyof typeof SIZE_MAP;

export interface SplannoLogoProps {
  /** sm = 20px icon, md = 24px, lg = 32px */
  size?: SplannoLogoSize;
  /** If true, only the icon is shown (no "splanno" text). */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Splanno logo: two overlapping speech bubbles (blue + orange), calendar & dollar icons,
 * decorative dots. Uses CSS variables for theme (light/dark).
 */
export function SplannoLogo({
  size = "md",
  iconOnly = false,
  className,
}: SplannoLogoProps) {
  const { icon: iconPx, text: textClass } = SIZE_MAP[size];

  return (
    <span
      className={cn("inline-flex items-center gap-2 shrink-0", className)}
      aria-hidden
    >
      <svg
        width={iconPx}
        height={iconPx}
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
        {/* Right bubble (orange) – overlaps left */}
        <path
          d="M22 12a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6V12z"
          fill="hsl(var(--splanno-orange))"
        />
        {/* Left bubble: small decorative dots (lighter blue) */}
        <circle cx="10" cy="11" r="1.8" fill="white" fillOpacity="0.6" />
        <circle cx="14" cy="13" r="1.2" fill="white" fillOpacity="0.5" />
        {/* Right bubble: small decorative dots (lighter orange) */}
        <circle cx="38" cy="11" r="1.8" fill="white" fillOpacity="0.6" />
        <circle cx="34" cy="13" r="1.2" fill="white" fillOpacity="0.5" />
        {/* Calendar icon (left bubble) – white card + grid + check */}
        <rect x="8" y="14" width="12" height="14" rx="1.5" fill="white" />
        <rect x="8" y="14" width="12" height="4" rx="1.5" fill="white" fillOpacity="0.9" />
        <line x1="8" y1="18" x2="20" y2="18" stroke="hsl(var(--splanno-blue))" strokeWidth="0.8" strokeOpacity="0.5" />
        <line x1="12" y1="18" x2="12" y2="28" stroke="hsl(var(--splanno-blue))" strokeWidth="0.6" strokeOpacity="0.5" />
        <line x1="16" y1="18" x2="16" y2="28" stroke="hsl(var(--splanno-blue))" strokeWidth="0.6" strokeOpacity="0.5" />
        <path d="M14 26l2 2 4-4" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* Dollar / money icon (right bubble) – light green bill with white $ */}
        <rect x="28" y="14" width="14" height="18" rx="2" fill="hsl(var(--splanno-green))" />
        <text x="35" y="26" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="system-ui, sans-serif">$</text>
        {/* Floating purple dots */}
        <circle cx="24" cy="5" r="2" fill="hsl(var(--splanno-purple))" />
        <circle cx="28" cy="6" r="1.4" fill="hsl(var(--splanno-purple))" />
        <circle cx="25" cy="42" r="1.4" fill="hsl(var(--splanno-purple))" />
      </svg>
      {!iconOnly && (
        <span
          className={cn(
            "font-semibold tracking-tight lowercase",
            textClass,
            "text-[hsl(var(--splanno-text))]"
          )}
          style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
        >
          splanno
        </span>
      )}
    </span>
  );
}
