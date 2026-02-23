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
 * Simple inline logo: wallet + calendar in one, with "Splanno" wordmark.
 * No external assets; uses CSS variables for theme.
 */
export function SplannoLogo({
  variant = "icon",
  size = 32,
  className,
}: SplannoLogoProps) {
  const iconSize = variant === "full" ? Math.round(size * 0.9) : size;
  const textSize = Math.round(size * 0.44);

  return (
    <span
      className={cn("inline-flex items-center gap-2 shrink-0", className)}
      style={{ height: size }}
      aria-hidden
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        {/* Calendar: left side - pad with binding tab + grid */}
        <rect x="2" y="6" width="18" height="22" rx="2.5" fill="hsl(var(--primary))" fillOpacity="0.9" />
        <path d="M2 10h18" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.4" strokeWidth="1.2" />
        <rect x="6" y="14" width="3" height="3" rx="0.5" fill="hsl(var(--primary-foreground))" fillOpacity="0.5" />
        <rect x="11" y="14" width="3" height="3" rx="0.5" fill="hsl(var(--primary-foreground))" fillOpacity="0.5" />
        <rect x="6" y="19" width="3" height="3" rx="0.5" fill="hsl(var(--primary-foreground))" fillOpacity="0.5" />
        <rect x="11" y="19" width="3" height="3" rx="0.5" fill="hsl(var(--primary-foreground))" fillOpacity="0.5" />
        {/* Wallet: right side - card shape with fold */}
        <rect x="20" y="8" width="18" height="24" rx="3" fill="hsl(var(--primary))" />
        <path d="M28 20h2" stroke="hsl(var(--primary-foreground))" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="28" cy="14" r="2.5" fill="hsl(var(--primary-foreground))" fillOpacity="0.5" />
      </svg>
      {variant === "full" && (
        <span
          className="font-semibold tracking-tight text-foreground shrink-0"
          style={{
            fontSize: textSize,
            lineHeight: 1,
            fontFamily: "var(--font-body), system-ui, sans-serif",
          }}
        >
          Splanno
        </span>
      )}
    </span>
  );
}
