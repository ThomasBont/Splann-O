"use client";

import { Link, useRoute } from "wouter";
import { MapPin, CalendarDays } from "lucide-react";
import { usePublicEvent } from "@/hooks/use-bbq-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PublicEventPage() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug ?? null;
  const { data, isLoading, error } = usePublicEvent(slug);
  const errorCode = error instanceof Error ? error.message : "";
  const isExpired = errorCode === "gone";
  const isUnavailable = errorCode === "not_found" || errorCode === "gone";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/explore">
            <Button variant="outline">Back to Explore</Button>
          </Link>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading event…</p>}
        {isUnavailable && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h1 className="text-xl font-semibold">Not available</h1>
              <p className="text-sm text-muted-foreground">
                {isExpired
                  ? "This public listing has expired."
                  : "This public event is not available."}
              </p>
              <p className="text-xs text-muted-foreground">
                It may be private, inactive, or no longer listed on Explore.
              </p>
            </CardContent>
          </Card>
        )}
        {error && !isUnavailable && (
          <p className="text-sm text-destructive">
            {errorCode === "rate_limited" ? "Too many requests. Please try again in a minute." : "Failed to load public event."}
          </p>
        )}

        {data && (
          <div className="space-y-5">
            <div className="h-48 rounded-2xl border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground">
              {data.bannerImageUrl ? (
                <img src={data.bannerImageUrl} alt={data.title} className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <span>Banner placeholder</span>
              )}
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h1 className="text-2xl font-semibold">{data.title}</h1>
                  {data.organizationName && (
                    <p className="text-sm text-muted-foreground mt-1">{data.organizationName}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {(data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ")) || "Location TBA"}
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {data.date ? new Date(data.date).toLocaleString() : "Date TBA"}
                  </p>
                </div>

                {data.publicDescription && (
                  <p className="text-sm leading-6 whitespace-pre-wrap">{data.publicDescription}</p>
                )}

                <div className="rounded-lg border bg-muted/20 p-4">
                  {data.publicMode === "joinable" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Request to join</p>
                      <p className="text-sm text-muted-foreground">Phase 1 stub: join requests will be connected in a later phase.</p>
                      <Button type="button" onClick={() => window.alert("Request to join (stub)")}>Request to join</Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Ask organizer for invite</p>
                      <p className="text-sm text-muted-foreground">
                        Visible on Explore. People can view details, but can only join with an invite link.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
