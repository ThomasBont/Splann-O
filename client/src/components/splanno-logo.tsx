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

const ASSETS = {
  full: {
    light: "/branding/splanno-full-light.png",
    dark: "/branding/splanno-full-dark.png",
  },
  icon: {
    light: "/branding/splanno-icon-light.png",
    dark: "/branding/splanno-icon-dark.png",
  },
} as const;

/**
 * Splanno logo using NEW assets from /public/branding.
 * Theme switching via Tailwind: light = block dark:hidden, dark = hidden dark:block.
 */
export function SplannoLogo({
  variant = "icon",
  size = 32,
  className,
}: SplannoLogoProps) {
  const lightSrc = ASSETS[variant].light;
  const darkSrc = ASSETS[variant].dark;

  return (
    <span
      className={cn("inline-block shrink-0", className)}
      style={{ height: size }}
      aria-hidden
    >
      {/* Light theme: visible by default, hidden in dark */}
      <img
        src={lightSrc}
        alt=""
        role="presentation"
        className="block dark:hidden h-full w-auto object-contain"
        style={{ height: size }}
        loading="eager"
        fetchPriority="high"
      />
      {/* Dark theme: hidden by default, visible in dark */}
      <img
        src={darkSrc}
        alt=""
        role="presentation"
        className="hidden dark:block h-full w-auto object-contain"
        style={{ height: size }}
        loading="eager"
        fetchPriority="high"
      />
    </span>
  );
}
