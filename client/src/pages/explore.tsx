"use client";

import * as React from "react";
import { Link } from "wouter";
import { Search, MapPin, CalendarDays, Compass, ArrowUpRight, Users } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useExploreEvents, type ExploreEvent } from "@/hooks/use-bbq-data";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { getEventTheme, getEventThemeStyle } from "@/lib/eventTheme";
import { InlineQueryError, SkeletonCard, SkeletonLine } from "@/components/ui/load-states";
import { EMPTY_COPY } from "@/lib/emotional-copy";

type ExploreSort = "soonest" | "newest" | "most-people";

function eventTime(e: ExploreEvent): number {
  if (!e.date) return Number.MAX_SAFE_INTEGER;
  const t = new Date(e.date).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function formatEventDate(date: string | null): string {
  if (!date) return "Date TBA";
  return new Date(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ExploreCard({ event, reducedMotion }: { event: ExploreEvent; reducedMotion: boolean }) {
  const theme = getEventTheme(event.themeCategory);
  const locationText = [event.city, event.countryName].filter(Boolean).join(", ") || "Location TBA";
  const listingActive =
    event.publicListingStatus === "active" &&
    !!event.publicListingExpiresAt &&
    new Date(event.publicListingExpiresAt).getTime() > Date.now();

  return (
    <Card
      style={getEventThemeStyle(event.themeCategory)}
      className={`h-full border-border/70 bg-card/80 backdrop-blur-sm transition-all ${reducedMotion ? "" : "duration-150 hover:-translate-y-0.5"} hover:shadow-lg hover:shadow-black/5`}
      data-testid={`explore-card-${event.id}`}
    >
      <div className={`h-0.5 w-full ${theme.classes.strip} opacity-60`} />
      <CardHeader className="pb-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <EventCategoryBadge category={event.themeCategory} compact />
          <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
            {event.publicMode === "joinable" ? "Joinable" : "Marketing"}
          </span>
          {listingActive && (
            <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              Listed
            </span>
          )}
        </div>
        <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
        {event.organizationName && (
          <CardDescription className="line-clamp-1">{event.organizationName}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{locationText}</span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span>{formatEventDate(event.date)}</span>
          </p>
        </div>

        {event.publicDescription && (
          <p className="text-sm text-muted-foreground line-clamp-3">{event.publicDescription}</p>
        )}

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>People count coming soon</span>
          </div>
          {event.publicListingExpiresAt && (
            <span className="hidden sm:inline">
              Until {new Date(event.publicListingExpiresAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <Link href={`/events/${event.publicSlug}`}>
          <Button variant="outline" className="w-full justify-between border-border/70">
            <span>View event</span>
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ExploreCardSkeleton() {
  return (
    <Card className="h-full border-border/60">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex gap-2">
          <SkeletonLine className="h-5 w-20 rounded-full" />
          <SkeletonLine className="h-5 w-16 rounded-full" />
        </div>
        <SkeletonLine className="h-5 w-3/4" />
        <SkeletonLine className="h-4 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-3">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-2/3" />
        <SkeletonCard className="h-12" />
        <SkeletonCard className="h-9" />
      </CardContent>
    </Card>
  );
}

export default function ExplorePage() {
  const { data: events = [], isLoading, error, refetch } = useExploreEvents();
  const reducedMotion = useReducedMotion();
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<ExploreSort>("soonest");
  const q = search.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    const base = !q
      ? events
      : events.filter((e) =>
          [e.title ?? "", e.city ?? "", e.countryName ?? "", e.organizationName ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q)
        );

    const sorted = [...base];
    if (sortBy === "newest") {
      sorted.sort((a, b) => eventTime(b) - eventTime(a));
    } else if (sortBy === "most-people") {
      // Explore payload does not expose attendee counts yet; keep stable fallback.
      sorted.sort((a, b) => eventTime(a) - eventTime(b));
    } else {
      sorted.sort((a, b) => eventTime(a) - eventTime(b));
    }
    return sorted;
  }, [events, q, sortBy]);

  const upcoming = React.useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return filtered
      .filter((e) => e.date && new Date(e.date).getTime() >= startOfToday.getTime())
      .sort((a, b) => eventTime(a) - eventTime(b))
      .slice(0, 5);
  }, [filtered]);

  const hasPeopleCounts = false;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Explore</h1>
            <p className="text-sm text-muted-foreground">Discover public events on Splanno.</p>
          </div>
          <Link href="/app">
            <Button variant="outline">Back to app</Button>
          </Link>
        </div>

        <div className="mb-6 rounded-2xl border border-border/60 bg-card/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, city, country, organizer"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2 sm:w-[220px]">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as ExploreSort)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soonest">Soonest</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                  {hasPeopleCounts ? (
                    <SelectItem value="most-people">Most people</SelectItem>
                  ) : (
                    <SelectItem value="most-people" disabled>Most people (soon)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ExploreCardSkeleton key={`sk-${i}`} />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <InlineQueryError
            message="Couldn’t load explore events. Try again."
            onRetry={() => {
              void refetch();
            }}
          />
        )}

        {!isLoading && !error && (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section className="space-y-3" aria-labelledby="upcoming-events">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-muted-foreground" />
                  <h2 id="upcoming-events" className="text-sm font-semibold tracking-wide text-foreground">
                    Upcoming
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map((event) => (
                    <ExploreCard key={`upcoming-${event.id}`} event={event} reducedMotion={!!reducedMotion} />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3" aria-labelledby="all-results">
              <div className="flex items-center justify-between gap-2">
                <h2 id="all-results" className="text-sm font-semibold tracking-wide text-foreground">
                  All results
                </h2>
                <p className="text-xs text-muted-foreground">{filtered.length} event{filtered.length === 1 ? "" : "s"}</p>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-border/60 bg-card/50 p-8 text-center">
                  <p className="text-sm font-medium">{EMPTY_COPY.exploreNoResultsTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{EMPTY_COPY.exploreNoResultsBody}</p>
                  <Link href="/app">
                    <Button variant="outline" className="mt-4">Back to app</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((event) => (
                    <ExploreCard key={event.id} event={event} reducedMotion={!!reducedMotion} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
