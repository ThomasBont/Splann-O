"use client";

import * as React from "react";
import { Link } from "wouter";
import { Search, MapPin, CalendarDays } from "lucide-react";
import { useExploreEvents } from "@/hooks/use-bbq-data";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExplorePage() {
  const { data: events = [], isLoading, error } = useExploreEvents();
  const [search, setSearch] = React.useState("");
  const q = search.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!q) return events;
    return events.filter((e) =>
      [e.city ?? "", e.countryName ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [events, q]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Explore</h1>
            <p className="text-sm text-muted-foreground">Discover public events on Splanno.</p>
          </div>
          <Link href="/app">
            <Button variant="outline">Back to app</Button>
          </Link>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by city or country"
            className="pl-9"
          />
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading events…</p>}
        {error && <p className="text-sm text-destructive">Failed to load explore events.</p>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((event) => (
            <Card key={event.id} className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
                {event.organizationName && (
                  <CardDescription>{event.organizationName}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {[event.city, event.countryName].filter(Boolean).join(", ") || "Location TBA"}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {event.date ? new Date(event.date).toLocaleDateString() : "Date TBA"}
                  </p>
                </div>
                {event.publicDescription && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{event.publicDescription}</p>
                )}
                <Link href={`/events/${event.publicSlug}`}>
                  <Button className="w-full">View</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {!isLoading && !error && filtered.length === 0 && (
          <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground mt-4">
            No public events found.
          </div>
        )}
      </div>
    </div>
  );
}
