import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBarbecues, useCheckoutPublicListing, useUpdateBarbecue } from "@/hooks/use-bbq-data";
import Home from "@/pages/home";
import ExplorePage from "@/pages/explore";
import { Loader2, Home as HomeIcon, Lock, Globe, Compass, Plus, Copy, Pin, PinOff, ExternalLink, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { loadLocalUserPreferences } from "@/lib/user-preferences";
import { copyText } from "@/lib/copy-text";
import type { Barbecue } from "@shared/schema";
import { isPrivateEvent, isPublicEvent } from "@shared/event-visibility";

type AppSection = "home" | "private" | "public" | "explore" | "event";

function getEventDateMs(event: Barbecue): number {
  const raw = (event.updatedAt as unknown as string) || (event.date as unknown as string) || "";
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function formatEventDate(date: unknown) {
  if (!date) return "Date TBA";
  const d = new Date(date as string);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatEventLocation(event: Barbecue) {
  if (event.locationName) return event.locationName;
  if (event.city && event.countryName) return `${event.city}, ${event.countryName}`;
  if (event.city) return event.city;
  if (event.countryName) return event.countryName;
  return "Location TBA";
}

function isPublicListed(event: Barbecue) {
  return isPublicEvent(event) && event.visibility === "public" && event.publicListingStatus === "active";
}

function getPublicHomeStatus(event: Barbecue): { label: string; tone: "default" | "secondary" | "outline" } {
  if (event.publicListingStatus === "paused") return { label: "Paused", tone: "secondary" };
  if (isPublicListed(event)) return { label: "Listed", tone: "default" };
  if (event.status === "draft") return { label: "Draft", tone: "outline" };
  return { label: "Unlisted", tone: "outline" };
}

function useEventLocalLists(user: { id?: number | null; username?: string | null } | null) {
  const [pinnedEventIds, setPinnedEventIds] = useState<number[]>([]);
  const [recentEventIds, setRecentEventIds] = useState<number[]>([]);

  const pinnedEventsStorageKey = useMemo(
    () => `splanno_pinned_events_${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const recentEventsStorageKey = useMemo(
    () => `splanno_recent_events_${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(localStorage.getItem(pinnedEventsStorageKey) ?? "[]");
      setPinnedEventIds(Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : []);
    } catch {
      setPinnedEventIds([]);
    }
  }, [pinnedEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(localStorage.getItem(recentEventsStorageKey) ?? "[]");
      setRecentEventIds(Array.isArray(parsed) ? parsed.filter((v): v is number => Number.isInteger(v)) : []);
    } catch {
      setRecentEventIds([]);
    }
  }, [recentEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(pinnedEventsStorageKey, JSON.stringify(pinnedEventIds.slice(0, 24)));
    } catch {
      // ignore
    }
  }, [pinnedEventIds, pinnedEventsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(recentEventsStorageKey, JSON.stringify(recentEventIds.slice(0, 20)));
    } catch {
      // ignore
    }
  }, [recentEventIds, recentEventsStorageKey]);

  return { pinnedEventIds, setPinnedEventIds, recentEventIds, setRecentEventIds };
}

function EventRow({
  event,
  href,
  trailing,
}: {
  event: Barbecue;
  href: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 p-2.5 hover:bg-muted/20 transition">
      <Link href={href}>
        <a className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate">{event.name}</p>
            <Badge variant="outline" className="rounded-full shrink-0">
              {isPublicEvent(event) ? "Public" : "Private"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {formatEventDate(event.date)} · {formatEventLocation(event)}
          </p>
        </a>
      </Link>
      {trailing}
    </div>
  );
}

function AppSidebar({ section }: { section: AppSection }) {
  const { data: events = [] } = useBarbecues();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...events].sort((a, b) => getEventDateMs(b) - getEventDateMs(a));
    if (!q) return sorted.slice(0, 8);
    return sorted.filter((event) => {
      const location = `${event.city ?? ""} ${event.countryName ?? ""} ${event.locationName ?? ""}`;
      return event.name.toLowerCase().includes(q) || location.toLowerCase().includes(q);
    }).slice(0, 8);
  }, [events, search]);

  const items: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> ; key: AppSection | "explore" }> = [
    { href: "/app/home", label: "Home", icon: HomeIcon, key: "home" },
    { href: "/app/private", label: "Private", icon: Lock, key: "private" },
    { href: "/app/public", label: "Public", icon: Globe, key: "public" },
    { href: "/app/explore", label: "Explore", icon: Compass, key: "explore" },
  ];

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="p-4 border-b border-border/60">
        <Link href="/app/home">
          <span className="text-sm font-semibold tracking-tight cursor-pointer">Splanno</span>
        </Link>
      </div>
      <nav className="p-3 space-y-1">
        {items.map((item) => {
          const active = section === item.key || (section === "event" && item.key === "home");
          const Icon = item.icon;
          return (
            <Link key={`app-nav-${item.href}`} href={item.href}>
              <a className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </a>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 pb-3 space-y-3 border-t border-border/60 mt-auto">
        <div className="pt-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Quick switch</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="h-8 text-xs"
          />
          <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-1.5">No events found</p>
            ) : (
              filtered.map((event) => (
                <Link key={`sidebar-event-${event.id}`} href={`/app/e/${event.id}`}>
                  <a className="block rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border/60 hover:bg-muted/30">
                    <p className="truncate font-medium">{event.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {isPublicEvent(event) ? "Public" : "Private"} · {formatEventLocation(event)}
                    </p>
                  </a>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 pb-1">
          <Link href="/app/private?new=private">
            <Button size="sm" className="w-full justify-start">
              <Plus className="h-4 w-4 mr-1.5" />
              New private event
            </Button>
          </Link>
          <Link href="/app/public?new=public">
            <Button size="sm" variant="outline" className="w-full justify-start">
              <Plus className="h-4 w-4 mr-1.5" />
              New public event
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  );
}

function AppDashboardHome() {
  const { data: events = [], isLoading } = useBarbecues();
  const recent = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const at = new Date((a.updatedAt as unknown as string) || (a.date as unknown as string) || 0).getTime();
      const bt = new Date((b.updatedAt as unknown as string) || (b.date as unknown as string) || 0).getTime();
      return bt - at;
    });
    return sorted.slice(0, 8);
  }, [events]);

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="text-sm text-muted-foreground">Your shared life dashboard across private and public events.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/private?new=private">
            <Button><Plus className="h-4 w-4 mr-2" />New private event</Button>
          </Link>
          <Link href="/app/public?new=public">
            <Button variant="outline"><Plus className="h-4 w-4 mr-2" />New public event</Button>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">Recent events</h2>
          <Link href="/app/private"><Button variant="ghost" size="sm">Open private</Button></Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">No events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first event to get started.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/app/private?new=private"><Button size="sm">Create private event</Button></Link>
              <Link href="/app/public?new=public"><Button size="sm" variant="outline">Create public event</Button></Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((event: Barbecue) => (
              <Link key={`recent-${event.id}`} href={`/app/e/${event.id}`}>
                <a className="flex items-center justify-between gap-3 rounded-xl border border-border/50 p-3 hover:bg-muted/20 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.date ? new Date(event.date).toLocaleDateString() : "Date TBA"}
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full">
                    {isPublicEvent(event) ? "Public" : "Private"}
                  </Badge>
                </a>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PrivateHomePage({ user }: { user: { id?: number | null; username?: string | null } | null }) {
  const { data: events = [], isLoading } = useBarbecues();
  const { pinnedEventIds, setPinnedEventIds, recentEventIds } = useEventLocalLists(user);
  const privateEvents = useMemo(
    () => events.filter((e) => isPrivateEvent(e)).sort((a, b) => getEventDateMs(b) - getEventDateMs(a)),
    [events],
  );
  const recentPrivateById = useMemo(() => new Map(privateEvents.map((e) => [e.id, e])), [privateEvents]);
  const pinnedPrivate = useMemo(
    () => pinnedEventIds.map((id) => recentPrivateById.get(id)).filter((e): e is Barbecue => !!e),
    [pinnedEventIds, recentPrivateById],
  );
  const fallbackPinned = useMemo(() => {
    if (pinnedPrivate.length > 0) return [];
    const recentIds = recentEventIds.filter((id) => recentPrivateById.has(id));
    return recentIds.map((id) => recentPrivateById.get(id)).filter((e): e is Barbecue => !!e).slice(0, 6);
  }, [pinnedPrivate.length, recentEventIds, recentPrivateById]);

  const togglePin = (eventId: number) => {
    setPinnedEventIds((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [eventId, ...prev]));
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Private events</h1>
          <p className="text-sm text-muted-foreground">Friends, circles, and split-cost plans in one place.</p>
        </div>
        <Link href="/app/private?new=private">
          <Button><Plus className="h-4 w-4 mr-2" />New private event</Button>
        </Link>
      </div>

      {(pinnedPrivate.length > 0 || fallbackPinned.length > 0) && (
        <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold">Pinned private events</h2>
            {pinnedPrivate.length === 0 && <span className="text-xs text-muted-foreground">Showing recent until you pin one</span>}
          </div>
          <div className="space-y-2">
            {(pinnedPrivate.length > 0 ? pinnedPrivate : fallbackPinned).map((event) => (
              <EventRow
                key={`private-pinned-${event.id}`}
                event={event}
                href={`/app/e/${event.id}`}
                trailing={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => togglePin(event.id)}
                    aria-label={pinnedEventIds.includes(event.id) ? "Unpin event" : "Pin event"}
                  >
                    {pinnedEventIds.includes(event.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">All private events</h2>
          <Badge variant="outline" className="rounded-full">{privateEvents.length}</Badge>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
            <div className="h-14 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : privateEvents.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">No private events yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create a circle for trips, dinners, or housemates.</p>
            <div className="mt-4">
              <Link href="/app/private?new=private"><Button size="sm">New private event</Button></Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {privateEvents.map((event) => (
              <EventRow
                key={`private-all-${event.id}`}
                event={event}
                href={`/app/e/${event.id}`}
                trailing={
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => togglePin(event.id)}
                    aria-label={pinnedEventIds.includes(event.id) ? "Unpin event" : "Pin event"}
                  >
                    {pinnedEventIds.includes(event.id) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PublicHomePage() {
  const { data: events = [], isLoading } = useBarbecues();
  const { toast } = useToast();
  const updateBbq = useUpdateBarbecue();
  const checkoutPublicListing = useCheckoutPublicListing();
  const [publicListTab, setPublicListTab] = useState<"drafts" | "listed">("drafts");

  const publicEvents = useMemo(
    () => events.filter((e) => isPublicEvent(e)).sort((a, b) => getEventDateMs(b) - getEventDateMs(a)),
    [events],
  );
  const listedEvents = useMemo(() => publicEvents.filter((e) => isPublicListed(e)), [publicEvents]);
  const draftEvents = useMemo(() => publicEvents.filter((e) => !isPublicListed(e)), [publicEvents]);
  const activeList = publicListTab === "listed" ? listedEvents : draftEvents;

  const copyLink = async (event: Barbecue) => {
    if (!event.publicSlug) {
      toast({ title: "Public link is not ready yet.", variant: "default" });
      return;
    }
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/events/${event.publicSlug}`;
    const ok = await copyText(url);
    if (ok) {
      toast({ title: "Link copied", variant: "success" });
    } else {
      toast({ title: "Couldn’t copy link", variant: "destructive" });
    }
  };

  const handlePublish = (event: Barbecue) => {
    if (event.publicListingStatus === "active") {
      updateBbq.mutate(
        { id: event.id, visibility: "public", publicMode: (event.publicMode === "joinable" ? "joinable" : "marketing") },
        {
          onSuccess: () => toast({ title: "Event published", variant: "success" }),
          onError: (err) => toast({ title: (err as Error).message, variant: "destructive" }),
        },
      );
      return;
    }
    checkoutPublicListing.mutate(
      { id: event.id, publicMode: (event.publicMode === "joinable" ? "joinable" : "marketing") },
      {
        onSuccess: (data) => {
          if (data?.url) window.location.href = data.url;
        },
        onError: (err) => {
          const msg = (err as Error).message || "Failed to start checkout";
          if (!/APP_URL/i.test(msg)) toast({ title: msg, variant: "destructive" });
        },
      },
    );
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Public events</h1>
          <p className="text-sm text-muted-foreground">Creator workspace for drafts, listings, and share-ready event pages.</p>
        </div>
        <Link href="/app/public?new=public">
          <Button><Plus className="h-4 w-4 mr-2" />New public event</Button>
        </Link>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg transition ${publicListTab === "drafts" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setPublicListTab("drafts")}
            >
              Draft / Unlisted
              <span className="ml-2 text-xs text-muted-foreground">{draftEvents.length}</span>
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg transition ${publicListTab === "listed" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setPublicListTab("listed")}
            >
              Listed / Published
              <span className="ml-2 text-xs text-muted-foreground">{listedEvents.length}</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Explore is separate: it shows listed public events from everyone.</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : activeList.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">{publicListTab === "drafts" ? "No drafts yet" : "No listed events yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {publicListTab === "drafts"
                ? "Create a public event to start your next listing."
                : "Publish a public event to make it discoverable in Explore."}
            </p>
            <div className="mt-4">
              <Link href="/app/public?new=public"><Button size="sm">New public event</Button></Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activeList.map((event) => {
              const status = getPublicHomeStatus(event);
              return (
                <div key={`public-home-${event.id}`} className="rounded-xl border border-border/50 p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-24 shrink-0 rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                      {event.bannerImageUrl ? (
                        <img src={event.bannerImageUrl} alt={event.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                          <Megaphone className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate">{event.name}</p>
                        <Badge variant={status.tone === "default" ? "default" : "outline"} className="rounded-full">
                          {status.label}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {event.publicMode === "joinable" ? "Joinable" : "Marketing"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground truncate">
                        {formatEventDate(event.date)} · {formatEventLocation(event)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/app/e/${event.id}`}>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="h-4 w-4 mr-1.5" />Open
                          </Button>
                        </Link>
                        <Button size="sm" variant="ghost" onClick={() => void copyLink(event)}>
                          <Copy className="h-4 w-4 mr-1.5" />Copy link
                        </Button>
                        {!isPublicListed(event) && (
                          <Button
                            size="sm"
                            onClick={() => handlePublish(event)}
                            disabled={checkoutPublicListing.isPending || updateBbq.isPending}
                          >
                            Publish
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AppRoute() {
  const [location, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();

  const pathname = typeof window !== "undefined" ? window.location.pathname : (location.split("?")[0] || "/app");
  const search = typeof window !== "undefined" ? window.location.search : "";
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const newFlow = searchParams.get("new");
  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading, setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/app") return;
    const url = new URL(window.location.href);
    const eventIdParam = Number(url.searchParams.get("eventId"));
    if (Number.isFinite(eventIdParam)) {
      setLocation(`/app/e/${eventIdParam}${url.search || ""}`, { replace: true });
      return;
    }
    const prefs = loadLocalUserPreferences(user?.id);
    const startRouteByPref: Record<string, string> = {
      home: "/app/home",
      private: "/app/private",
      public: "/app/public",
    };
    const startRoute = startRouteByPref[prefs.defaultStartPage] ?? "/app/home";
    setLocation(`${startRoute}${url.search || ""}`, { replace: true });
  }, [pathname, setLocation, user?.id]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  let section: AppSection = "home";
  let routeEventId: number | null = null;
  if (pathname.startsWith("/app/e/")) {
    section = "event";
    const raw = pathname.split("/app/e/")[1]?.split("/")[0];
    const n = Number(raw);
    routeEventId = Number.isFinite(n) ? n : null;
  } else if (pathname === "/app/private") {
    section = "private";
  } else if (pathname === "/app/public") {
    section = "public";
  } else if (pathname === "/app/explore") {
    section = "explore";
  } else {
    section = "home";
  }
  const shouldUseLegacyHomeForCreate =
    (section === "private" && newFlow === "private") ||
    (section === "public" && newFlow === "public");

  return (
    <div className="min-h-screen bg-background lg:flex">
      <AppSidebar section={section} />
      <main className="min-w-0 flex-1">
        {section === "home" && <AppDashboardHome />}
        {section === "explore" && <ExplorePage />}
        {section === "private" && (shouldUseLegacyHomeForCreate ? <Home appRouteMode="private" /> : <PrivateHomePage user={user} />)}
        {section === "public" && (shouldUseLegacyHomeForCreate ? <Home appRouteMode="public" /> : <PublicHomePage />)}
        {section === "event" && <Home appRouteMode="event" routeEventId={routeEventId} />}
      </main>
    </div>
  );
}
