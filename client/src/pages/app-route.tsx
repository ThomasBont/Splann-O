import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBarbecues } from "@/hooks/use-bbq-data";
import Home from "@/pages/home";
import {
  Loader2,
  Home as HomeIcon,
  Lock,
  Plus,
  Pin,
  PinOff,
  Menu,
  X,
  GripVertical,
  ChevronDown,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { loadLocalUserPreferences } from "@/lib/user-preferences";
import { EventHeaderPreferencesProvider } from "@/hooks/use-event-header-preferences";
import { useNewPlanWizard } from "@/contexts/new-plan-wizard";
import NewPlanWizardDrawer from "@/components/event/NewPlanWizardDrawer";
import { FEATURE_PUBLIC_PLANS } from "@/lib/features";
import {
  defaultPinGroups,
  defaultSidebarLayout,
  sanitizePinGroups,
  sanitizeSidebarLayout,
  type PinGroup,
  type SidebarLayout,
  type SidebarSectionConfig,
  type SidebarWidth,
  type SmartSectionKind,
} from "@/lib/sidebar-layout";
import type { Barbecue } from "@shared/schema";
import { isPrivateEvent } from "@shared/event-visibility";
import { InlineQueryError, SkeletonCard } from "@/components/ui/load-states";
import { EMPTY_COPY } from "@/lib/emotional-copy";

type AppSection = "home" | "private" | "event";
type DevDisableFlags = {
  headerPrefs: boolean;
  discoverModal: boolean;
  homeEffects: boolean;
};

const DEV_DISABLE_DEFAULT: DevDisableFlags = {
  headerPrefs: false,
  discoverModal: false,
  homeEffects: false,
};

function parseDevDisableFlags(search: string): DevDisableFlags {
  if (!import.meta.env.DEV) return DEV_DISABLE_DEFAULT;
  const params = new URLSearchParams(search);
  const kill = params.get("kill");
  if (!kill) return DEV_DISABLE_DEFAULT;
  const set = new Set(kill.split(",").map((token) => token.trim().toLowerCase()).filter(Boolean));
  return {
    headerPrefs: set.has("headerprefs"),
    discoverModal: set.has("discovermodal"),
    homeEffects: set.has("home"),
  };
}

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
            <Badge variant="outline" className="rounded-full shrink-0">Private</Badge>
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

function NewEventMenuButton({
  className,
  size = "default",
  align = "start",
  onCreate,
}: {
  className?: string;
  size?: "sm" | "md" | "default" | "lg";
  align?: "start" | "end" | "center";
  onCreate?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={className} size={size}>
          <Plus className="h-4 w-4 mr-1.5" />
          New plan
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72">
        <DropdownMenuItem
          className="flex flex-col items-start py-2"
          onSelect={() => {
            onCreate?.();
          }}
        >
          <span className="text-sm font-medium">Friends plan</span>
          <span className="text-xs text-muted-foreground">Plan with your crew and split costs</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppSidebar({ section, onCreatePlan }: { section: AppSection; onCreatePlan: () => void }) {
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useBarbecues();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pinGroups, setPinGroups] = useState<PinGroup[]>(() => defaultPinGroups());
  const [advanced, setAdvanced] = useState({
    showUnsettled: false,
    showUpcoming: false,
    showPinGroups: false,
  });

  const pinGroupsKey = useMemo(
    () => `splanno.sidebar.pin-groups.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const recentOpenedKey = useMemo(
    () => `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const advancedKey = useMemo(
    () => `splanno.sidebar.advanced.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  // Shared between desktop sidebar + mobile drawer so collapse preference stays in sync.
  const recentCollapsedKey = "splanno.sidebar.recentCollapsed";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawGroups = localStorage.getItem(pinGroupsKey);
      const rawAdvanced = localStorage.getItem(advancedKey);
      const rawRecentCollapsed = localStorage.getItem(recentCollapsedKey);
      setPinGroups(sanitizePinGroups(rawGroups ? JSON.parse(rawGroups) : null));
      if (rawAdvanced) {
        const parsed = JSON.parse(rawAdvanced) as Partial<typeof advanced>;
        setAdvanced((prev) => ({ ...prev, ...parsed }));
      }
      if (rawRecentCollapsed != null) {
        setRecentCollapsed(rawRecentCollapsed === "true");
      }
    } catch {
      setPinGroups(defaultPinGroups());
      setAdvanced({
        showUnsettled: false,
        showUpcoming: false,
        showPinGroups: false,
      });
      setRecentCollapsed(false);
    }
  }, [pinGroupsKey, advancedKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(pinGroupsKey, JSON.stringify(pinGroups));
      localStorage.setItem(advancedKey, JSON.stringify(advanced));
      localStorage.setItem(recentCollapsedKey, String(recentCollapsed));
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [pinGroups, advanced, recentCollapsed, pinGroupsKey, advancedKey]);

  const privateEvents = useMemo(
    () => events.filter((event) => isPrivateEvent(event)),
    [events],
  );
  const eventById = useMemo(() => new Map(privateEvents.map((event) => [event.id, event])), [privateEvents]);
  const allSortedEvents = useMemo(() => [...privateEvents].sort((a, b) => getEventDateMs(b) - getEventDateMs(a)), [privateEvents]);

  const recentOpenedIds = useMemo(() => {
    if (typeof window === "undefined") return [] as number[];
    try {
      const raw = JSON.parse(localStorage.getItem(recentOpenedKey) ?? "[]");
      return Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
    } catch {
      return [];
    }
  }, [recentOpenedKey, privateEvents.length]);

  const recentEvents = useMemo(() => {
    if (recentOpenedIds.length === 0) return allSortedEvents.slice(0, 12);
    const byId = new Map(allSortedEvents.map((event) => [event.id, event]));
    const fromHistory = recentOpenedIds.map((id) => byId.get(id)).filter((event): event is Barbecue => !!event);
    if (fromHistory.length >= 8) return fromHistory.slice(0, 12);
    const existingIds = new Set(fromHistory.map((e) => e.id));
    return [...fromHistory, ...allSortedEvents.filter((e) => !existingIds.has(e.id))].slice(0, 12);
  }, [allSortedEvents, recentOpenedIds]);

  const searchedEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentEvents;
    return allSortedEvents
      .filter((event) => {
        const location = `${event.city ?? ""} ${event.countryName ?? ""} ${event.locationName ?? ""}`;
        return event.name.toLowerCase().includes(q) || location.toLowerCase().includes(q);
      })
      .slice(0, 12);
  }, [allSortedEvents, recentEvents, search]);

  const pinnedEventIds = useMemo(() => {
    const ids = new Set<number>();
    pinGroups.forEach((group) => group.eventIds.forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [pinGroups]);
  const pinnedEvents = useMemo(
    () => pinnedEventIds.map((id) => eventById.get(id)).filter((event): event is Barbecue => !!event).slice(0, 8),
    [pinnedEventIds, eventById],
  );

  const advancedUnsettled = useMemo(
    () => allSortedEvents.filter((event) => isPrivateEvent(event) && event.status !== "settled").slice(0, 8),
    [allSortedEvents],
  );
  const advancedUpcoming = useMemo(() => {
    const now = new Date();
    const upper = new Date(now);
    upper.setDate(upper.getDate() + 14);
    return allSortedEvents
      .filter((event) => {
        if (!event.date) return false;
        const d = new Date(event.date as unknown as string);
        return d >= now && d <= upper;
      })
      .slice(0, 8);
  }, [allSortedEvents]);

  const items: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> ; key: AppSection }> = [
    { href: "/app/home", label: "Home", icon: HomeIcon, key: "home" },
    { href: "/app/private", label: "Private", icon: Lock, key: "private" },
  ];

  const renderEventList = (list: Barbecue[], emptyMessage: string, limit = 12) => (
    <div className="space-y-1 pr-1">
      {eventsLoading ? (
        <div className="space-y-2 py-1">
          <SkeletonCard className="h-10 rounded-md" />
          <SkeletonCard className="h-10 rounded-md" />
          <SkeletonCard className="h-10 rounded-md" />
        </div>
      ) : eventsError ? (
        <InlineQueryError
          message="Couldn’t load events."
          onRetry={() => {
            void refetchEvents();
          }}
        />
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-1.5">{emptyMessage}</p>
      ) : (
        list.slice(0, limit).map((event) => (
          <Link key={`sidebar-event-${event.id}`} href={`/app/e/${event.id}`}>
            <a className="block rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border/60 hover:bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{event.name}</p>
                <span className="shrink-0 rounded-full border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">Private</span>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {formatEventLocation(event)}
              </p>
            </a>
          </Link>
        ))
      )}
    </div>
  );

  return (
    <aside className="group/sidebar hidden lg:flex w-64 lg:shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="h-screen w-full flex flex-col">
        <div className="px-4 py-4 border-b border-border/60 shrink-0">
          <Link href="/app/home">
            <span className="text-sm font-semibold tracking-tight cursor-pointer">Splanno</span>
          </Link>
        </div>
        <nav className="px-3 py-3 space-y-1 shrink-0">
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

        <div className="px-3 pb-3 flex-1 min-h-0">
          <div className="sticky top-4 h-[calc(100vh-2rem)] min-h-0 flex flex-col gap-3">
            <div className="border-t border-border/60 pt-3 shrink-0">
              <NewEventMenuButton className="w-full justify-start" align="start" onCreate={onCreatePlan} />
            </div>

            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/60 bg-card/70">
              <div className="shrink-0 border-b border-border/50 p-2 space-y-2">
            <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Your plans</p>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search plans..."
                  className="h-8 text-xs"
                />
              </div>
              {/* min-h-0 keeps flex children shrinkable so only this list area scrolls */}
              <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
                {pinnedEvents.length > 0 && (
                  <div className="space-y-1">
                    <p className="px-1 text-[11px] font-medium text-muted-foreground">Pinned</p>
                    {renderEventList(pinnedEvents, "No pinned plans", 5)}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-medium text-muted-foreground">Recent plans</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{searchedEvents.length}</span>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={recentCollapsed ? "Expand recent plans" : "Collapse recent plans"}
                        aria-expanded={!recentCollapsed}
                        aria-controls="sidebar-recent-events-list"
                        onClick={() => setRecentCollapsed((v) => !v)}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${recentCollapsed ? "" : "rotate-180"}`} />
                      </button>
                    </div>
                  </div>
                  {recentCollapsed ? (
                    <p className="px-1 py-1 text-[11px] text-muted-foreground">{searchedEvents.length} hidden</p>
                  ) : (
                    <div id="sidebar-recent-events-list">
                      {renderEventList(searchedEvents, "No plans found")}
                    </div>
                  )}
                </div>

                {(advanced.showUpcoming || advanced.showUnsettled || advanced.showPinGroups) && (
                  <div className="space-y-2">
                    {advanced.showUpcoming && (
                      <section className="rounded-xl border border-border/60 bg-card/70 p-2">
                        <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Upcoming</p>
                        {renderEventList(advancedUpcoming, "No upcoming plans", 6)}
                      </section>
                    )}
                    {advanced.showUnsettled && (
                      <section className="rounded-xl border border-border/60 bg-card/70 p-2">
                        <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Unsettled</p>
                        {renderEventList(advancedUnsettled, "Everything is settled", 6)}
                      </section>
                    )}
                    {advanced.showPinGroups && (
                      <section className="rounded-xl border border-border/60 bg-card/70 p-2">
                        <p className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Pin groups</p>
                        <div className="space-y-2">
                          {pinGroups.map((group) => {
                            const groupEvents = group.eventIds.map((id) => eventById.get(id)).filter((event): event is Barbecue => !!event);
                            return (
                              <div key={group.id} className="rounded-lg border border-border/50 p-2">
                                <p className="text-xs font-medium mb-1">{group.name}</p>
                                {renderEventList(groupEvents, "No plans in this group", 4)}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-border/50 p-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setCustomizeOpen(true)}
                >
                  <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                  Customize
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Modal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        onOpenChange={setCustomizeOpen}
        title="Customize sidebar"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Choose which advanced sections appear in your sidebar.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Show Unsettled</p>
              <Switch checked={advanced.showUnsettled} onCheckedChange={(checked) => setAdvanced((prev) => ({ ...prev, showUnsettled: checked }))} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Show Upcoming</p>
              <Switch checked={advanced.showUpcoming} onCheckedChange={(checked) => setAdvanced((prev) => ({ ...prev, showUpcoming: checked }))} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm">Show Pin Groups section</p>
              <Switch checked={advanced.showPinGroups} onCheckedChange={(checked) => setAdvanced((prev) => ({ ...prev, showPinGroups: checked }))} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCustomizeOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}

function AppDashboardHome({ onCreatePlan }: { onCreatePlan: () => void }) {
  const { data: events = [], isLoading, error, refetch } = useBarbecues();
  const recent = useMemo(() => {
    const sorted = [...events].filter((event) => isPrivateEvent(event)).sort((a, b) => {
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
          <p className="text-sm text-muted-foreground">Turn ideas into plans with your friends.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">Quick actions</h2>
        <NewEventMenuButton onCreate={onCreatePlan} />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">Recent plans</h2>
          <Link href="/app/private"><Button variant="ghost" size="sm">Open private</Button></Link>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <SkeletonCard className="h-12" />
            <SkeletonCard className="h-12" />
            <SkeletonCard className="h-12" />
          </div>
        ) : error ? (
          <InlineQueryError
            message="Couldn’t load recent plans. Try again."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : recent.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
                <p className="text-sm font-medium">{EMPTY_COPY.recentEventsTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{EMPTY_COPY.recentEventsBody}</p>
            <div className="mt-4 flex justify-center gap-2">
              <NewEventMenuButton size="sm" onCreate={onCreatePlan} />
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
                <Badge variant="outline" className="rounded-full">Private</Badge>
              </a>
            </Link>
          ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PrivateHomePage({ user, onCreatePlan }: { user: { id?: number | null; username?: string | null } | null; onCreatePlan: () => void }) {
  const { data: events = [], isLoading, error, refetch } = useBarbecues();
  const { pinnedEventIds, setPinnedEventIds } = useEventLocalLists(user);
  const privateEvents = useMemo(
    () => events.filter((e) => isPrivateEvent(e)).sort((a, b) => getEventDateMs(b) - getEventDateMs(a)),
    [events],
  );
  const togglePin = (eventId: number) => {
    setPinnedEventIds((prev) => (prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [eventId, ...prev]));
  };

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Friends plans</h1>
          <p className="text-sm text-muted-foreground">A plan buddy for friend groups.</p>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">All plans</h2>
          <Badge variant="outline" className="rounded-full">{privateEvents.length}</Badge>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <SkeletonCard className="h-14" />
            <SkeletonCard className="h-14" />
            <SkeletonCard className="h-14" />
          </div>
        ) : error ? (
          <InlineQueryError
            message="Couldn’t load plans. Try again."
            onRetry={() => {
              void refetch();
            }}
          />
        ) : privateEvents.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">{EMPTY_COPY.privateListTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{EMPTY_COPY.privateListBody}</p>
            <div className="mt-4">
              <NewEventMenuButton size="sm" onCreate={onCreatePlan} />
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

export default function AppRoute() {
  const [location, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { openNewPlanWizard } = useNewPlanWizard();
  const { data: appEvents = [] } = useBarbecues();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobileQuickSwitchSearch, setMobileQuickSwitchSearch] = useState("");
  const [mobileRecentCollapsed, setMobileRecentCollapsed] = useState(false);

  const pathname = typeof window !== "undefined" ? window.location.pathname : (location.split("?")[0] || "/app");
  const search = typeof window !== "undefined" ? window.location.search : "";
  const devDisable = useMemo(() => parseDevDisableFlags(search), [search]);
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
      public: "/app/private",
    };
    const startRoute = startRouteByPref[prefs.defaultStartPage] ?? "/app/home";
    setLocation(`${startRoute}${url.search || ""}`, { replace: true });
  }, [pathname, setLocation, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "private") return;
    openNewPlanWizard("BASICS");
    url.searchParams.delete("new");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [location, openNewPlanWizard]);

  let section: AppSection = "home";
  let routeEventId: number | null = null;
  if (pathname.startsWith("/app/e/")) {
    section = "event";
    const raw = pathname.split("/app/e/")[1]?.split("/")[0];
    const n = Number(raw);
    routeEventId = Number.isFinite(n) ? n : null;
  } else if (pathname === "/app/private") {
    section = "private";
  } else {
    section = "home";
  }
  useEffect(() => {
    if (!FEATURE_PUBLIC_PLANS && (pathname === "/app/public" || pathname === "/app/explore")) {
      setLocation("/app/private", { replace: true });
    }
  }, [pathname, setLocation]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSidebarOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    if (isSidebarOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = prev || "";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem("splanno.sidebar.recentCollapsed");
    if (raw != null) setMobileRecentCollapsed(raw === "true");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("splanno.sidebar.recentCollapsed", String(mobileRecentCollapsed));
  }, [mobileRecentCollapsed]);

  const mobileQuickSwitchEvents = useMemo(() => {
    const q = mobileQuickSwitchSearch.trim().toLowerCase();
    const sorted = [...appEvents].filter((event) => isPrivateEvent(event)).sort((a, b) => getEventDateMs(b) - getEventDateMs(a));
    if (!q) return sorted.slice(0, 8);
    return sorted.filter((event) => {
      const locationText = `${event.city ?? ""} ${event.countryName ?? ""} ${event.locationName ?? ""}`;
      return event.name.toLowerCase().includes(q) || locationText.toLowerCase().includes(q);
    }).slice(0, 8);
  }, [appEvents, mobileQuickSwitchSearch]);

  const currentEventName = useMemo(() => {
    if (section !== "event" || !routeEventId) return null;
    return appEvents.find((e) => e.id === routeEventId)?.name ?? null;
  }, [section, routeEventId, appEvents]);

  useEffect(() => {
    if (section !== "event" || !routeEventId) return;
    const event = appEvents.find((candidate) => candidate.id === routeEventId);
    if (!event) return;
    if (!isPrivateEvent(event)) {
      setLocation("/app/private", { replace: true });
    }
  }, [section, routeEventId, appEvents, setLocation]);

  const mobileSectionLabel = section === "event"
    ? (currentEventName ?? "Event")
    : section === "private"
      ? "Private"
      : "Home";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (section !== "event" || !routeEventId) return;
    const key = `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`;
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
      const ids = Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
      const next = [routeEventId, ...ids.filter((id) => id !== routeEventId)].slice(0, 20);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      localStorage.setItem(key, JSON.stringify([routeEventId]));
    }
  }, [section, routeEventId, user?.id, user?.username]);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return;
    (window as Window & { __splannoDebug?: unknown }).__splannoDebug = {
      activeKills: devDisable,
      lastRenderAt: new Date().toISOString(),
    };
  }, [devDisable]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  const anyKillActive = devDisable.headerPrefs || devDisable.discoverModal || devDisable.homeEffects;
  const handleOpenNewPlan = () => {
    openNewPlanWizard("BASICS");
  };
  const mainContent = (
    <div className="min-h-screen bg-background lg:flex">
        <header className="lg:hidden sticky top-0 z-40 h-14 border-b border-border/60 bg-background/95 backdrop-blur-sm">
          <div className="h-full px-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <p className="text-sm font-semibold truncate px-2">{mobileSectionLabel}</p>
            <div className="w-9" />
          </div>
        </header>

        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="Close navigation drawer"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-[86vw] max-w-xs bg-background border-r border-border/60 shadow-xl flex flex-col">
              <div className="h-14 px-4 border-b border-border/60 flex items-center justify-between">
                <span className="text-sm font-semibold tracking-tight">Splanno</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSidebarOpen(false)} aria-label="Close drawer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <nav className="p-3 space-y-1 shrink-0">
                {[
                  { href: "/app/home", label: "Home", icon: HomeIcon, key: "home" as AppSection },
                  { href: "/app/private", label: "Private", icon: Lock, key: "private" as AppSection },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = section === item.key || (section === "event" && item.key === "home");
                  return (
                    <Link key={`mobile-nav-${item.href}`} href={item.href}>
                      <a
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </a>
                    </Link>
                  );
                })}
              </nav>
              <div className="border-y border-border/60 px-3 py-3 space-y-2 shrink-0">
                <NewEventMenuButton
                  className="w-full justify-start"
                  align="start"
                  onCreate={() => {
                    setIsSidebarOpen(false);
                    handleOpenNewPlan();
                  }}
                />
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Your plans</p>
                  <Input
                    value={mobileQuickSwitchSearch}
                    onChange={(e) => setMobileQuickSwitchSearch(e.target.value)}
                    placeholder="Search plans..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="px-3 py-3 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-1 pr-1">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[11px] font-medium text-muted-foreground">Recent plans</p>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={mobileRecentCollapsed ? "Expand recent plans" : "Collapse recent plans"}
                      aria-expanded={!mobileRecentCollapsed}
                      aria-controls="mobile-recent-events-list"
                      onClick={() => setMobileRecentCollapsed((v) => !v)}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileRecentCollapsed ? "" : "rotate-180"}`} />
                    </button>
                  </div>
                  {mobileRecentCollapsed ? (
                    <p className="text-xs text-muted-foreground px-1 py-1.5">{mobileQuickSwitchEvents.length} hidden</p>
                  ) : mobileQuickSwitchEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-1.5">No plans found</p>
                  ) : (
                    <div id="mobile-recent-events-list" className="space-y-1">
                      {mobileQuickSwitchEvents.map((event) => (
                        <Link key={`mobile-event-${event.id}`} href={`/app/e/${event.id}`}>
                          <a
                            onClick={() => setIsSidebarOpen(false)}
                            className="block rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border/60 hover:bg-muted/30"
                          >
                            <p className="truncate font-medium">{event.name}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              Private · {formatEventLocation(event)}
                            </p>
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        <AppSidebar section={section} onCreatePlan={handleOpenNewPlan} />
        <main className="min-w-0 flex-1">
          {section === "home" && <AppDashboardHome onCreatePlan={handleOpenNewPlan} />}
          {section === "private" && (
            devDisable.homeEffects
              ? <div className="p-6 text-sm text-muted-foreground">Home effects disabled via kill switch.</div>
              : <Home appRouteMode="private" debugDisableDiscoverModal={devDisable.discoverModal} />
          )}
          {section === "event" && (
            devDisable.homeEffects
              ? <div className="p-6 text-sm text-muted-foreground">Home effects disabled via kill switch.</div>
              : (
                <Home
                  appRouteMode="event"
                  routeEventId={routeEventId}
                  debugDisableDiscoverModal={devDisable.discoverModal}
                />
              )
          )}
        </main>
        <NewPlanWizardDrawer />
        {import.meta.env.DEV && anyKillActive && (
          <div className="fixed bottom-3 left-3 z-[100] rounded-md border border-amber-300 bg-amber-100/95 px-2 py-1 text-[11px] text-amber-900 shadow-sm">
            kill: {Object.entries(devDisable).filter(([, enabled]) => enabled).map(([name]) => name).join(", ")}
          </div>
        )}
      </div>
  );

  return devDisable.headerPrefs
    ? mainContent
    : (
      <EventHeaderPreferencesProvider userKey={`${user?.id ?? user?.username ?? "anon"}`}>
        {mainContent}
      </EventHeaderPreferencesProvider>
    );
}
