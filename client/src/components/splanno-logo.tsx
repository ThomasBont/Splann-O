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

/** Single source of truth: /public/branding assets. Transparent PNGs, no white boxes. */
const ASSETS = {
  icon: {
    light: "/branding/splanno-icon-light.png",
    dark: "/branding/splanno-icon-dark.png",
  },
  full: {
    light: "/branding/splanno-logo-light.png",
    dark: "/branding/splanno-logo-dark.png",
  },
} as const;

/**
 * Reusable Splanno logo. Automatically switches by theme (Tailwind dark:).
 * - Navbar: use variant="icon"
 * - Hero: use variant="full"
 * Transparent backgrounds only; no background on container.
 */
export function SplannoLogo({
  variant = "icon",
  size = 32,
  className,
}: SplannoLogoProps) {
  const { light, dark } = ASSETS[variant];

  return (
    <span
      className={cn("inline-block shrink-0 bg-transparent", className)}
      style={{ height: size }}
      aria-hidden
    >
      <img
        src={light}
        alt=""
        role="presentation"
        height={size}
        className="block dark:hidden h-full w-auto max-w-none object-contain object-left"
        style={{ height: size }}
        loading="eager"
        fetchPriority="high"
      />
      <img
        src={dark}
        alt=""
        role="presentation"
        height={size}
        className="hidden dark:block h-full w-auto max-w-none object-contain object-left"
        style={{ height: size }}
        loading="eager"
        fetchPriority="high"
      />
    </span>
  );
}
