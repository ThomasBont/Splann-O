"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export type SplannoLogoVariant = "full" | "icon";

export interface SplannoLogoProps {
  /** Logo variant: full (icon + wordmark) or icon-only. */
  variant?: SplannoLogoVariant;
  /** Render height in pixels. Width auto-scales to preserve aspect ratio. */
  size?: number;
  className?: string;
}

const SOURCES = {
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
 * Single source of truth for the Splanno logo.
 *
 * - Theme-aware: picks light/dark PNG based on the current theme.
 * - Variant-aware: `full` (icon + wordmark) vs `icon` only.
 * - Retina crisp: uses object-contain and pixel height for sharp rendering.
 */
export function SplannoLogo({
  variant = "icon",
  size = 32,
  className,
}: SplannoLogoProps) {
  const { theme } = useTheme();
  const mode = theme === "dark" ? "dark" : "light";
  const src = SOURCES[variant][mode];

  return (
    <img
      src={src}
      alt="Splanno"
      style={{ height: size, width: "auto" }}
      className={cn(
        "inline-block align-middle object-contain",
        theme === "dark" ? "drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" : "",
        className
      )}
      loading="eager"
      fetchPriority="high"
    />
  );
}
