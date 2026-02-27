"use client";

import { Link, useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { MapPin, CalendarDays, Share2, Users, BadgeCheck, Ticket, MessageSquare } from "lucide-react";
import { useConversation, useCreatePublicConversation, usePublicEvent, usePublicEventMessagingEligibility, usePublicEventRsvpSummary, useSendConversationMessage, useSubmitPublicEventRsvp } from "@/hooks/use-bbq-data";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/lib/copy-text";
import { buildIcs, downloadIcs, inferEventDateRange } from "@/lib/calendar-ics";
import { buildMapsUrl, openMaps } from "@/lib/maps";
import { EMPTY_COPY, UI_COPY } from "@/lib/emotional-copy";

export default function PublicEventPage() {
  const [, params] = useRoute("/events/:slug");
  const slug = params?.slug ?? null;
  const { data, isLoading, error } = usePublicEvent(slug);
  const rsvpSummary = usePublicEventRsvpSummary(slug);
  const submitRsvp = useSubmitPublicEventRsvp(slug);
  const { user } = useAuth();
  const { toast } = useToast();
  const [messageOpen, setMessageOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const messagingEligibility = usePublicEventMessagingEligibility(data?.id ?? null, !!data && !!user);
  const createConversation = useCreatePublicConversation(data?.id ?? null);
  const conversation = useConversation(conversationId, messageOpen && !!conversationId);
  const sendMessage = useSendConversationMessage(conversationId);
  const errorCode = error instanceof Error ? error.message : "";
  const isExpired = errorCode === "gone";
  const isUnavailable = errorCode === "not_found" || errorCode === "gone";
  const shareUrl = useMemo(() => (slug && typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : ""), [slug]);

  useEffect(() => {
    setBannerLoaded(false);
  }, [data?.bannerImageUrl, data?.id]);

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

  useEffect(() => {
    if (!data || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("created") !== "1") return;
    toast({
      variant: "success",
      title: "Public page created",
      message: "Your event is ready to share.",
      actionLabel: "Copy share link",
      onAction: async () => {
        if (!shareUrl) return;
        const ok = await copyText(shareUrl);
        if (ok) {
          toast({ variant: "success", message: UI_COPY.toasts.copied });
        } else {
          toast({ variant: "default", message: "Press Ctrl/Cmd+C to copy the link" });
        }
      },
    });
    url.searchParams.delete("created");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [data, shareUrl, toast]);

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
      const ok = await copyText(shareUrl);
      if (ok) toast({ variant: "success", message: UI_COPY.toasts.copied });
      else toast({ variant: "default", message: "Copy failed — select and copy manually." });
    } catch {
      toast({ variant: "error", message: "Couldn’t share event link. Try again." });
    }
  };

  const handleAddToCalendar = () => {
    if (!data?.date || !slug) return;
    const range = inferEventDateRange(data.date);
    if (!range) {
      toast({ variant: "default", message: "Event date is missing or invalid." });
      return;
    }
    const location = (data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ")) || null;
    const url = typeof window !== "undefined" ? `${window.location.origin}/events/${slug}` : "";
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const ics = buildIcs({
      uid: data.publicSlug ? `event-${data.publicSlug}@splanno` : `event-${data.id}@splanno`,
      title: data.title,
      start: range.start,
      end: range.end,
      allDay: range.allDay,
      location,
      description: data.publicDescription ?? data.subtitle ?? null,
      url,
      timezone,
    });
    const safeName = (data.title || "public-event")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "public-event";
    downloadIcs(`${safeName}.ics`, ics);
    toast({ variant: "success", message: "Calendar file downloaded" });
  };

  const handleOpenInMaps = () => {
    if (!data) return;
    const query = data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ");
    if (!query) return;
    const url = buildMapsUrl({
      query,
      label: data.title,
      lat: data.latitude ?? undefined,
      lng: data.longitude ?? undefined,
    });
    openMaps(url);
  };

  const openMessaging = async () => {
    if (!data) return;
    try {
      const convo = await createConversation.mutateAsync();
      setConversationId(convo.id);
      setMessageOpen(true);
    } catch (err) {
      toast({ variant: "destructive", title: (err as Error).message || "Could not open conversation" });
    }
  };

  const submitMessage = async () => {
    const body = draftMessage.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync(body);
      setDraftMessage("");
    } catch (err) {
      const msg = (err as Error).message || "Could not send message";
      toast({ variant: "destructive", title: msg === "NOT_AUTHORIZED" ? "You can message the organizer after requesting to join." : msg });
    }
  };

  return (
    <div className={`min-h-screen ${data ? templateClasses[data.publicTemplate ?? "classic"] : "bg-background"}`}>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between mb-6">
          <Link href="/explore">
            <Button variant="outline">Back to Explore</Button>
          </Link>
          <div className="flex items-center gap-2">
            {data?.date && (
              <Button variant="outline" onClick={handleAddToCalendar}>
                <CalendarDays className="h-4 w-4 mr-1.5" />
                Add to Calendar
              </Button>
            )}
            <Button variant="outline" onClick={handleShare} disabled={!data}>
              <Share2 className="h-4 w-4 mr-1.5" />
              {UI_COPY.actions.share}
            </Button>
          </div>
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
            <div className={`relative h-48 sm:h-60 rounded-2xl border bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-muted-foreground overflow-hidden ${data.publicTemplate === "keynote" ? "shadow-lg" : ""}`}>
              {data.bannerImageUrl ? (
                <>
                  <img
                    src={data.bannerImageUrl}
                    alt={data.title}
                    onLoad={() => setBannerLoaded(true)}
                    className={`h-full w-full object-cover rounded-2xl transition-opacity duration-200 ${bannerLoaded ? "opacity-100" : "opacity-0"}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent pointer-events-none" />
                </>
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
                  {data.subtitle && (
                    <p className="text-sm text-foreground/80 mt-1">{data.subtitle}</p>
                  )}
                  {data.organizationName && (
                    <p className="text-sm text-muted-foreground mt-1">{data.organizationName}</p>
                  )}
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 min-w-0">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {(data.locationName ?? [data.city, data.countryName].filter(Boolean).join(", ")) || "Location TBA"}
                      </span>
                    </p>
                    {(data.locationName || data.city || data.countryName) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px] shrink-0"
                        onClick={handleOpenInMaps}
                        aria-label="Open location in Maps"
                      >
                        Open in Maps
                      </Button>
                    )}
                  </div>
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {data.date ? new Date(data.date).toLocaleString() : "Date TBA"}
                  </p>
                </div>

                <p className="text-sm leading-6 whitespace-pre-wrap text-foreground/90">
                  {data.publicDescription || EMPTY_COPY.publicNoDetails}
                </p>

                {data.organizer && (
                  <div className="rounded-xl border bg-muted/15 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Organizer</p>
                      <Link href={`/u/${data.organizer.handle || data.organizer.username}`}>
                        <a className="inline-flex items-center gap-1.5 text-sm font-semibold hover:text-primary">
                          {data.organizer.displayName || data.organizer.username}
                          {data.organizer.verifiedHost && <BadgeCheck className="h-4 w-4 text-primary" />}
                        </a>
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{data.organizer.publicEventsHosted} public event{data.organizer.publicEventsHosted === 1 ? "" : "s"} hosted</p>
                    </div>
                      <Link href={`/u/${data.organizer.handle || data.organizer.username}`}>
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
                        {rsvpSummary.data?.myRsvp ? `Your RSVP: ${rsvpSummary.data.myRsvp.status}` : EMPTY_COPY.publicNoRsvp}
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

                <div className="rounded-lg border bg-card/70 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Message organizer</p>
                      <p className="text-xs text-muted-foreground">
                        Ask a question or follow up on your join request in the event inbox.
                      </p>
                      {user && messagingEligibility.data?.isOrganizer && (
                        <p className="text-xs text-muted-foreground">You’re the organizer. Use the Event Inbox in your event workspace.</p>
                      )}
                      {user && messagingEligibility.data && !messagingEligibility.data.canMessageOrganizer && !messagingEligibility.data.isOrganizer && (
                        <p className="text-xs text-muted-foreground">
                          {messagingEligibility.data.reason === "request_to_join_first"
                            ? "Request to join to message the organizer."
                            : "Only invited or approved attendees can message the organizer."}
                        </p>
                      )}
                      {!user && (
                        <p className="text-xs text-muted-foreground">Sign in to message the organizer.</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={openMessaging}
                      disabled={!user || messagingEligibility.data?.isOrganizer === true || !!(messagingEligibility.data && !messagingEligibility.data.canMessageOrganizer) || createConversation.isPending}
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" />
                      Message organizer
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <Modal
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        onOpenChange={setMessageOpen}
        title="Event inbox"
        subtitle={data ? `${data.title} — Organizer conversation` : undefined}
        size="xl"
        scrollable
        className="w-[760px] max-w-[96vw] h-[70vh] max-h-[85vh]"
      >
        {!conversationId ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Open a conversation to message the organizer.</div>
        ) : conversation.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-12 w-1/2 ml-auto" />
            <Skeleton className="h-12 w-3/5" />
          </div>
        ) : conversation.data ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
              Professional event inbox. Messages stay linked to this event.
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {conversation.data.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{EMPTY_COPY.publicNoMessages}</p>
              ) : (
                conversation.data.messages.map((msg) => {
                  const mine = !!user && msg.senderUserId === user.id;
                  return (
                    <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted/30 border border-border/50"}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                          {msg.sender?.displayName || msg.sender?.username || "User"} · {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex items-end gap-2 pt-1">
              <Textarea
                value={draftMessage}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Write a message to the organizer…"
                className="min-h-[72px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
              />
              <Button onClick={() => void submitMessage()} disabled={sendMessage.isPending || !draftMessage.trim()}>
                Send
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Couldn’t load conversation.</p>
        )}
      </Modal>
    </div>
  );
}
