"use client";

import { Link, useRoute } from "wouter";
import { useEffect, useMemo } from "react";
import { MapPin, CalendarDays, Share2, Users, BadgeCheck, Ticket } from "lucide-react";
import { usePublicEvent, usePublicEventRsvpSummary, useSubmitPublicEventRsvp } from "@/hooks/use-bbq-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicEventPage() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug ?? null;
  const { data, isLoading, error } = usePublicEvent(slug);
  const rsvpSummary = usePublicEventRsvpSummary(slug);
  const submitRsvp = useSubmitPublicEventRsvp(slug);
  const { toast } = useToast();
  const errorCode = error instanceof Error ? error.message : "";
  const isExpired = errorCode === "gone";
  const isUnavailable = errorCode === "not_found" || errorCode === "gone";
  const shareUrl = useMemo(() => (slug && typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : ""), [slug]);

  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    document.title = `${data.title} · Splanno`;
    const metaDesc = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    metaDesc.setAttribute("content", data.publicDescription || `Public event in ${data.city || data.countryName || "your city"} on Splanno`);
    const ogImage = document.querySelector('meta[property="og:image"]') ?? (() => {
      const m = document.createElement("meta");
      m.setAttribute("property", "og:image");
      document.head.appendChild(m);
      return m;
    })();
    ogImage.setAttribute("content", data.bannerImageUrl || `${window.location.origin}/api/share/event/${data.id}.svg`);
  }, [data]);

  const templateClasses = {
    classic: "bg-background",
    keynote: "bg-gradient-to-b from-background to-muted/20",
    workshop: "bg-gradient-to-b from-background to-emerald-500/5",
    nightlife: "bg-gradient-to-b from-background to-fuchsia-500/5",
    meetup: "bg-gradient-to-b from-background to-sky-500/5",
  } as const;

  const handleShare = async () => {
    if (!shareUrl || !data) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: data.title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: "success", message: "Link copied" });
    } catch {
      toast({ variant: "error", message: "Couldn’t share event link" });
    }
  };

  return (
    <div className={`min-h-screen ${data ? templateClasses[data.publicTemplate ?? "classic"] : "bg-background"}`}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/explore">
            <Button variant="outline">Back to Explore</Button>
          </Link>
          <Button variant="outline" onClick={handleShare} disabled={!data}>
            <Share2 className="h-4 w-4 mr-1.5" />
            Share
          </Button>
        </div>

        {isLoading && (
          <div className="space-y-5">
            <div className="h-48 sm:h-60 rounded-2xl border border-border/60 bg-card p-3">
              <Skeleton className="h-full w-full rounded-xl" />
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/5" />
                </div>
                <div className="rounded-xl border border-border/60 p-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
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
            <div className={`h-48 sm:h-60 rounded-2xl border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground overflow-hidden ${data.publicTemplate === "keynote" ? "shadow-lg" : ""}`}>
              {data.bannerImageUrl ? (
                <img src={data.bannerImageUrl} alt={data.title} className="h-full w-full object-cover rounded-2xl" />
              ) : (
                <span>Banner placeholder</span>
              )}
            </div>

            <Card className={data.publicTemplate === "nightlife" ? "border-fuchsia-500/20" : undefined}>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h1 className={`font-semibold ${data.publicTemplate === "keynote" ? "text-3xl" : "text-2xl"}`}>{data.title}</h1>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-full">{data.publicMode === "joinable" ? "Joinable" : "Marketing"}</Badge>
                      <Badge variant="outline" className="rounded-full">Public</Badge>
                      {data.publicListingStatus !== "active" ? (
                        <Badge variant="outline" className="rounded-full text-muted-foreground">Unlisted draft</Badge>
                      ) : null}
                    </div>
                  </div>
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

                {data.organizer && (
                  <div className="rounded-xl border bg-muted/15 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Organizer</p>
                      <Link href={`/u/${data.organizer.username}`}>
                        <a className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
                          {data.organizer.displayName || data.organizer.username}
                          {data.organizer.verifiedHost && <BadgeCheck className="h-4 w-4 text-primary" />}
                        </a>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{data.organizer.publicEventsHosted} public event{data.organizer.publicEventsHosted === 1 ? "" : "s"} hosted</p>
                    </div>
                    <Link href={`/u/${data.organizer.username}`}>
                      <Button variant="outline" size="sm">Organizer profile</Button>
                    </Link>
                  </div>
                )}

                {data.rsvpTiers.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Tickets / RSVP</p>
                    </div>
                    <div className="space-y-2">
                      {(rsvpSummary.data?.tiers ?? data.rsvpTiers.map((t) => ({ ...t, counts: { requested: 0, approved: 0, declined: 0, going: 0 }, soldOut: false }))).map((tier) => (
                        <div key={tier.id} className="rounded-xl border border-border/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{tier.name}</p>
                              {tier.description && <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>}
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{tier.isFree ? "Free" : (tier.priceLabel || "Price on request")}</span>
                                {tier.capacity != null && <span>Capacity {tier.capacity}</span>}
                                {(tier.counts.approved + tier.counts.going) > 0 && <span>{tier.counts.approved + tier.counts.going} going</span>}
                              </div>
                            </div>
                            {data.publicMode === "joinable" ? (
                              <Button
                                size="sm"
                                disabled={tier.soldOut || submitRsvp.isPending}
                                onClick={() => submitRsvp.mutate({ tierId: tier.id, status: "requested" })}
                              >
                                {tier.soldOut ? "Sold out" : "Request to join"}
                              </Button>
                            ) : (
                              <div className="text-right">
                                <p className="text-xs font-medium text-muted-foreground">Join with invite link</p>
                                <p className="text-xs text-muted-foreground mt-1">Marketing mode</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/20 p-4">
                  {data.publicMode === "joinable" ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Request to join</p>
                      <p className="text-sm text-muted-foreground">Choose a tier above to send a request. Organizers can review requests before approving.</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {rsvpSummary.data?.myRsvp ? `Your RSVP: ${rsvpSummary.data.myRsvp.status}` : "No RSVP yet"}
                      </div>
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
