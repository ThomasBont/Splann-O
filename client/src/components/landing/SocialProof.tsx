"use client";

import { cn } from "@/lib/utils";

export interface SocialProofProps {
  tagline: string;
  eventsCount: string;
  sharedCosts: string;
  countries: string;
  /** Placeholder avatar initials for visual */
  avatarPlaceholders?: string[];
}

const DEFAULT_AVATARS = ["JD", "MK", "AL", "SR", "PT"];

export function SocialProof({
  tagline,
  eventsCount,
  sharedCosts,
  countries,
  avatarPlaceholders = DEFAULT_AVATARS,
}: SocialProofProps) {
  return (
    <section className="py-12 sm:py-16 border-y border-border/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground mb-6">
          {tagline}
        </p>
        <div className="flex justify-center gap-2 mb-8">
          {avatarPlaceholders.map((initials, i) => (
            <div
              key={i}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold",
                "bg-primary/15 text-primary border-2 border-background dark:border-card",
                "shadow-sm"
              )}
              style={{ marginLeft: i > 0 ? -8 : 0 }}
            >
              {initials}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 md:gap-8 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{eventsCount}</p>
            <p className="text-sm text-muted-foreground mt-0.5">events split</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{sharedCosts}</p>
            <p className="text-sm text-muted-foreground mt-0.5">shared costs</p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{countries}</p>
            <p className="text-sm text-muted-foreground mt-0.5">countries</p>
          </div>
        </div>
      </div>
    </section>
  );
}
