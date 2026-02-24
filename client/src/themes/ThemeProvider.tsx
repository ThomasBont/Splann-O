"use client";

import * as React from "react";
import { getThemeConfig } from "./themeRegistry";
import type { ThemeKind } from "./themeRegistry";

export interface EventThemeContextValue {
  themeId: string;
  kind: ThemeKind;
  /** HSL values for CSS vars (e.g. "24 95% 53%") */
  accent: {
    primary: string;
    secondary: string;
    surface: string;
    border: string;
  };
  signature: {
    type: string;
    intensity: number;
  };
}

const defaultValue: EventThemeContextValue = {
  themeId: "other_party",
  kind: "party",
  accent: { primary: "43 96% 56%", secondary: "43 96% 48%", surface: "43 20% 96%", border: "43 30% 88%" },
  signature: { type: "glow", intensity: 0.2 },
};

const EventThemeContext = React.createContext<EventThemeContextValue>(defaultValue);

export interface EventThemeProviderProps {
  kind: ThemeKind;
  eventType: string | null | undefined;
  children: React.ReactNode;
}

/**
 * Provides event-level theme (accent, signature) for the current event.
 * Applies CSS variables on the wrapping div for child consumption.
 */
export function EventThemeProvider({ kind, eventType, children }: EventThemeProviderProps) {
  const config = React.useMemo(() => getThemeConfig(kind, eventType), [kind, eventType]);

  const value: EventThemeContextValue = React.useMemo(
    () => ({
      themeId: config.id,
      kind: config.kind,
      accent: config.accent,
      signature: config.signature,
    }),
    [config]
  );

  const cssVars = React.useMemo(
    () => ({
      "--theme-primary": config.accent.primary,
      "--theme-secondary": config.accent.secondary,
      "--theme-surface": config.accent.surface,
      "--theme-border": config.accent.border,
      "--theme-glow-opacity": String(config.signature.intensity),
      "--theme-bg-motif-opacity": String(Math.min(0.15, config.signature.intensity * 0.3)),
    }),
    [config]
  );

  return (
    <EventThemeContext.Provider value={value}>
      <div className="event-theme-root" style={cssVars as React.CSSProperties}>
        {children}
      </div>
    </EventThemeContext.Provider>
  );
}

export function useEventTheme() {
  return React.useContext(EventThemeContext) ?? defaultValue;
}
