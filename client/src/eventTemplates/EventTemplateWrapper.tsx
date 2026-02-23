"use client";

import { useTheme } from "@/hooks/use-theme";
import type { EventTemplate, EventTemplateTokens } from "./types";

const BACKGROUND_LAYER_OPACITY = 0.08; // 8% – subtle, within 5–12% range

function applyTokens(style: React.CSSProperties, tokens: EventTemplateTokens): React.CSSProperties {
  return {
    ...style,
    ["--background" as string]: tokens.background,
    ["--foreground" as string]: tokens.foreground,
    ["--card" as string]: tokens.card,
    ["--card-foreground" as string]: tokens.cardForeground,
    ["--accent" as string]: tokens.accent,
    ["--accent-foreground" as string]: tokens.accentForeground,
  };
}

export interface EventTemplateWrapperProps {
  template: EventTemplate;
  children: React.ReactNode;
  className?: string;
  /** Optional subtle background decoration (e.g. gradient). Applied as extra class. */
  decorationClass?: string;
  /** Optional CSS background-image for a background layer. Applied at low opacity (5–12%). */
  backgroundStyle?: string;
}

/**
 * Wraps event content and applies the template's theme tokens as CSS variables.
 * Optionally renders a subtle background layer (gradient/glow) behind content.
 * Light/dark mode is respected via useTheme().
 */
export function EventTemplateWrapper({
  template,
  children,
  className = "",
  decorationClass = "",
  backgroundStyle,
}: EventTemplateWrapperProps) {
  const { theme: resolvedTheme } = useTheme();
  const { tokens, wrapperClass: baseClassFromTheme } = template.theme;
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const resolvedTokens = tokens ? (tokens.dark && mode === "dark" ? tokens.dark : tokens.light) : null;

  const baseClass = baseClassFromTheme ?? "";
  const style =
    resolvedTokens != null
      ? applyTokens({}, resolvedTokens)
      : undefined;
  const tokenClass = resolvedTokens != null ? "bg-background text-foreground" : "";

  return (
    <div className={`relative overflow-hidden ${baseClass} ${tokenClass} ${decorationClass} ${className}`.trim()} style={style}>
      {backgroundStyle && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-[1]"
          style={{
            backgroundImage: backgroundStyle,
            opacity: BACKGROUND_LAYER_OPACITY,
          }}
        />
      )}
      {children}
    </div>
  );
}
