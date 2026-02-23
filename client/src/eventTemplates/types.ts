import type { ReactNode } from "react";

/** Template key used in the registry. Maps from DB eventType for UI theming. */
export type EventTemplateKey = "default" | "barbecue" | "birthday" | "trip" | "party";

/**
 * Theme tokens for one mode (light or dark).
 * Values are HSL triplets without "hsl()" so they work with hsl(var(--x)), e.g. "25 70% 96%".
 */
export interface EventTemplateTokens {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  accent: string;
  accentForeground: string;
}

/** Theme: tokens per mode + optional wrapper class. */
export interface EventTemplateTheme {
  /** Tokens for light mode. If omitted, global theme is used (no override). */
  tokens?: {
    light: EventTemplateTokens;
    dark?: EventTemplateTokens;
  };
  /** Optional extra Tailwind class for the wrapper (e.g. rounded-2xl). */
  wrapperClass?: string;
}

/** Header/hero style for the event view. */
export type HeroStyle = "none" | "banner" | "minimal" | "full";

export interface EventTemplate {
  key: EventTemplateKey;
  theme: EventTemplateTheme;
  heroStyle: HeroStyle;
  heroContent?: ReactNode;
  extraSections?: string[];
}
