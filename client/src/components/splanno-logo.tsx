"use client";

import { cn } from "@/lib/utils";

const SIZE_MAP = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 96,
} as const;

export type SplannoLogoSize = keyof typeof SIZE_MAP;

export interface SplannoLogoProps {
  /** sm = 40px (header), md = 48px, lg = 64px, xl = 80px, 2xl = 96px */
  size?: SplannoLogoSize;
  /** If true, only the icon part is shown (square crop). */
  iconOnly?: boolean;
  className?: string;
}

const LOGO_SRC = "/splanno-logo.png";

/**
 * Splanno logo: uses the official brand image asset.
 * Retina-friendly; supports size and icon-only (square crop) modes.
 */
export function SplannoLogo({
  size = "md",
  iconOnly = false,
  className,
}: SplannoLogoProps) {
  const px = SIZE_MAP[size];

  if (iconOnly) {
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        style={{ width: px, height: px }}
        aria-hidden
      >
        <img
          src={LOGO_SRC}
          alt=""
          width={px}
          height={px}
          className="w-full h-full object-cover object-left"
          style={{ borderRadius: "12%" }}
          loading="eager"
          fetchPriority="high"
        />
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0", className)}
      style={{ height: px }}
      aria-hidden
    >
      <img
        src={LOGO_SRC}
        alt="Splanno"
        height={px}
        width="auto"
        className="h-full w-auto object-contain"
        loading="eager"
        fetchPriority="high"
      />
    </span>
  );
}
