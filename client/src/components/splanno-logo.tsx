"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

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

// Single transparent icon source used for both light and dark themes.
// The wordmark is rendered as text so it can adapt to the current theme colors.
const LOGO_ICON_SRC = "/splanno-logo.svg";

const WORDMARK_SIZE_MAP: Record<SplannoLogoSize, string> = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl",
  "2xl": "text-4xl",
};

/**
 * Official Splanno logo.
 *
 * - `iconOnly` → brand icon only (square), used for nav, favicon, compact UI.
 * - default (full) → icon + wordmark, for hero/auth/marketing.
 *
 * Theme-aware via `useTheme` for subtle dark-mode shadow; wordmark color uses
 * the `--brand-secondary` token so it stays readable on light/dark backgrounds.
 */
export function SplannoLogo({
  size = "md",
  iconOnly = false,
  className,
}: SplannoLogoProps) {
  const px = SIZE_MAP[size];
  const { theme } = useTheme();
  const dropShadowClass =
    theme === "dark" ? "drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]" : "";

  if (iconOnly) {
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        style={{ width: px, height: px }}
        aria-hidden
      >
        <img
          src={LOGO_ICON_SRC}
          alt=""
          width={px}
          height={px}
          className={cn("w-full h-full object-contain", dropShadowClass)}
          loading="eager"
          fetchPriority="high"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 shrink-0",
        className
      )}
      style={{ height: px }}
      aria-hidden
    >
      <img
        src={LOGO_ICON_SRC}
        alt=""
        height={px}
        width="auto"
        className={cn("h-full w-auto object-contain", dropShadowClass)}
        loading="eager"
        fetchPriority="high"
      />
      <span
        className={cn(
          "font-display font-semibold tracking-tight text-[hsl(var(--brand-secondary))]",
          WORDMARK_SIZE_MAP[size]
        )}
      >
        Splanno
      </span>
    </span>
  );
}
