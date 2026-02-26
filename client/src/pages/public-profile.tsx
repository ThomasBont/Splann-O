"use client";

import { useEffect, useMemo, useState } from "react";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  CalendarDays,
  Globe,
  MapPin,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { usePublicProfile } from "@/hooks/use-bbq-data";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatEventDate(value: string | null) {
  if (!value) return "Date TBA";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "Date TBA";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function memberBadge(createdAt: string | null) {
  if (!createdAt) return "Early";
  const d = new Date(createdAt);
  if (!Number.isFinite(d.getTime())) return "Early";
  return `Joined ${d.getFullYear()}`;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export default function PublicProfilePage() {
  const [, params] = useRoute("/u/:username");
  const username = params?.username ?? null;
  const { data, isLoading, error } = usePublicProfile(username);
  const { toast } = useToast();
  const [headerCompact, setHeaderCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setHeaderCompact(window.scrollY > 72);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const profile = data?.profile;
  const events = data?.events ?? [];
  const ratioLabel = data?.stats.ratioLabel;

  const shareUrl = useMemo(
    () => (username && typeof window !== "undefined" ? `${window.location.origin}/u/${encodeURIComponent(username)}` : ""),
    [username],
  );

  const handleShare = async () => {
    if (!shareUrl || !profile) return;
    const title = `${profile.displayName || profile.username} on Splanno`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, url: shareUrl });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: "success", message: "Link copied" });
    } catch {
      toast({ variant: "error", message: "Couldn’t share profile link" });
    }
  };

  const notFound = error instanceof Error && error.message === "not_found";
  const fetchFailed = error instanceof Error && error.message !== "not_found";

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/explore">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className={cn("flex items-center gap-2 min-w-0 transition-all duration-150", headerCompact ? "opacity-100" : "opacity-0 pointer-events-none -translate-y-1")}>
              <Avatar className="h-7 w-7">
                {profile?.profileImageUrl || profile?.avatarUrl ? (
                  <AvatarImage src={profile.profileImageUrl || profile.avatarUrl || ""} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">{initials(profile?.displayName || profile?.username || "U")}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium truncate">{profile?.displayName || profile?.username || "Profile"}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={handleShare} disabled={!username}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {isLoading && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-card to-muted/20 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-full max-w-xl" />
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
            <StatsSkeleton />
            <div className="space-y-3">
              <EventCardSkeleton />
              <EventCardSkeleton />
              <EventCardSkeleton />
            </div>
          </div>
        )}

        {!isLoading && notFound && (
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-muted">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <h1 className="text-xl font-semibold">Profile not found</h1>
              <p className="mt-2 text-sm text-muted-foreground">This public profile does not exist, or the handle is no longer available.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && fetchFailed && (
          <Card className="rounded-3xl border-border/60">
            <CardContent className="p-8 text-center">
              <h1 className="text-xl font-semibold">Couldn’t load profile</h1>
              <p className="mt-2 text-sm text-muted-foreground">Please try again in a moment.</p>
            </CardContent>
          </Card>
        )}

        {!isLoading && data && profile && (
          <div className="space-y-6">
            <section className="rounded-3xl border border-border/60 bg-gradient-to-b from-card via-card to-muted/20 p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="rounded-full bg-gradient-to-br from-primary/25 via-accent/10 to-primary/10 p-[2px]">
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 bg-background">
                      {profile.profileImageUrl || profile.avatarUrl ? (
                        <AvatarImage src={profile.profileImageUrl || profile.avatarUrl || ""} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xl font-semibold">
                        {initials(profile.displayName || profile.username)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl truncate">{profile.displayName || profile.username}</h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">@{profile.username}</p>
                    {profile.bio ? (
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground/90">
                        {profile.bio.slice(0, 120)}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 text-primary">
                        <Sparkles className="mr-1 h-3 w-3" />
                        {memberBadge(profile.createdAt)}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-muted-foreground">
                        Only events you choose to make public appear here.
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button variant="outline" className="rounded-xl self-start" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                  Share profile
                </Button>
              </div>
            </section>

            <section aria-label="Profile stats">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Public events hosted</p>
                    <p className="mt-1 text-xl font-semibold">{data.stats.publicEventsHosted}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total attendees</p>
                    <p className="mt-1 text-xl font-semibold">{data.stats.totalAttendees}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Profile type</p>
                    <p className="mt-1 text-sm font-medium">{ratioLabel ?? "Public view"}</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Visibility</p>
                    <p className="mt-1 text-sm font-medium">Privacy-first</p>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Public events</h2>
                  <p className="text-sm text-muted-foreground">Only events you choose to make public appear here.</p>
                </div>
              </div>

              {events.length === 0 ? (
                <Card className="rounded-3xl border-border/60">
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-muted/60">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="font-medium">No public events yet — only events you choose to make public appear here.</p>
                    {data.viewerIsOwner && (
                      <p className="mt-2 text-sm text-muted-foreground">Publish an event to show it here.</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <Link key={event.id} href={`/events/${event.publicSlug}`}>
                      <a className="block">
                        <Card className="rounded-2xl border-border/60 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995]">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50 shrink-0">
                                <EventCategoryBadge category={event.themeCategory} compact />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-semibold truncate">{event.title}</h3>
                                  <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0 text-muted-foreground">Public</Badge>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    {formatEventDate(event.date)}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {event.locationName ?? ([event.city, event.countryName].filter(Boolean).join(", ") || "Location TBA")}
                                  </span>
                                  <span className="inline-flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {event.attendeeCount} attendee{event.attendeeCount === 1 ? "" : "s"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
