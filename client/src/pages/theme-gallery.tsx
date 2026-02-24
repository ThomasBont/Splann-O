"use client";

import { EventThemeHeader } from "@/components/event/EventThemeHeader";
import { cardClass } from "@/theme/themeClassnames";
import { TRIP_THEMES, PARTY_THEMES, TRIP_THEME_KEYS, PARTY_THEME_KEYS } from "@/theme/eventThemes";
import type { ThemeToken } from "@/theme/eventThemes";
import { Link } from "wouter";

/**
 * Dev-only Theme Gallery. Shows all event themes for visual verification.
 * Guarded by import.meta.env.DEV - does not render in production build.
 */
export default function ThemeGalleryPage() {
  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <p className="text-muted-foreground">Theme gallery is only available in development.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Event Theme Gallery</h1>
          <Link href="/app" className="text-sm text-primary hover:underline">
            ← Back to App
          </Link>
        </div>
        <p className="text-muted-foreground">
          All event themes for visual verification. Each card shows EventThemeHeader + sample card.
        </p>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Trips</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TRIP_THEME_KEYS.map((key) => {
              const theme = TRIP_THEMES[key];
              return (
                <ThemeCard
                  key={key}
                  theme={theme}
                  title={`Sample ${theme.label} Event`}
                  category="trip"
                  type={key}
                />
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Parties</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PARTY_THEME_KEYS.map((key) => {
              const theme = PARTY_THEMES[key];
              return (
                <ThemeCard
                  key={key}
                  theme={theme}
                  title={`Sample ${theme.label} Event`}
                  category="party"
                  type={key}
                />
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  title,
  category,
  type,
}: {
  theme: ThemeToken;
  title: string;
  category: "trip" | "party";
  type: string;
}) {
  return (
    <div className={`${cardClass(theme)} space-y-3 p-4`}>
      <EventThemeHeader category={category} type={type} title={title} theme={theme} />
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <p className="font-medium text-foreground">Sample expense card</p>
        <p className="mt-1 text-xs text-muted-foreground">{theme.copy.tagline}</p>
      </div>
    </div>
  );
}
