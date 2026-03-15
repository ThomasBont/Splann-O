import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  useAcceptFriendRequestNotification,
  useAcceptPlanInvite,
  useBarbecues,
  type BarbecueListItem,
  useDeclineFriendRequestNotification,
  useDeclinePlanInvite,
  useNotifications,
} from "@/hooks/use-bbq-data";
import Home from "@/pages/home";
import {
  Loader2,
  Plus,
  Pin,
  PinOff,
  Menu,
  Bell,
  UserCircle,
  X,
  ChevronDown,
  Trash2,
  Users,
  Camera,
  Receipt,
  StickyNote,
  Zap,
  LayoutGrid,
  BarChart3,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { circularActionButtonClass } from "@/lib/utils";
import { EventHeaderPreferencesProvider } from "@/hooks/use-event-header-preferences";
import { useNewPlanWizard } from "@/contexts/new-plan-wizard";
import NewPlanWizardDrawer from "@/components/event/NewPlanWizardDrawer";
import { SplannOLogo } from "@/components/branding/SplannOLogo";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FEATURE_PUBLIC_PLANS } from "@/lib/features";
import { getEventTheme } from "@/theme/useEventTheme";
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
import { usePrefetchPlan } from "@/hooks/use-prefetch-plan";
import { usePanel } from "@/state/panel";
import { resolveAssetUrl } from "@/lib/asset-url";
import { startPlanSwitchPerf } from "@/lib/plan-switch-perf";
import { formatPlanDateRange } from "@/lib/dates";

type AppSection = "home" | "private" | "event";
type DevDisableFlags = {
  headerPrefs: boolean;
  discoverModal: boolean;
  homeEffects: boolean;
};
const LAST_PLAN_STORAGE_KEY = "splanno:lastPlanId";

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

function getEventCreatedMs(event: Barbecue): number {
  const maybeCreatedAt = (event as unknown as { createdAt?: unknown }).createdAt;
  const raw =
    (maybeCreatedAt as string | undefined)
    || (event.updatedAt as unknown as string)
    || (event.date as unknown as string)
    || "";
  const ms = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function formatEventDate(event: Pick<Barbecue, "startDate" | "endDate" | "date">) {
  return formatPlanDateRange(event.startDate, event.endDate, event.date) ?? "Date TBA";
}

function formatEventLocation(event: Barbecue) {
  if (event.locationName) return event.locationName;
  if (event.city && event.countryName) return `${event.city}, ${event.countryName}`;
  if (event.city) return event.city;
  if (event.countryName) return event.countryName;
  return "Location TBA";
}

function getSidebarEventDotClass(event: Pick<Barbecue, "area" | "eventType" | "status">) {
  if (event.status === "settled") return "bg-emerald-400/60";
  if (event.status === "archived") return "bg-slate-400/70";
  if (event.status === "closed") return "bg-amber-400/70";
  const category = event.area === "trips" ? "trip" : "party";
  return getEventTheme(category, event.eventType ?? null).accent.bg;
}

function isArchivedPlan(event: Pick<Barbecue, "status">) {
  return event.status === "archived";
}

function isRunningPlan(event: Pick<Barbecue, "status">) {
  return !isArchivedPlan(event);
}

function toEventId(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
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
            {formatEventDate(event)} · {formatEventLocation(event)}
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
  iconOnly = false,
  label = "New plan",
  showLeadingIcon = true,
}: {
  className?: string;
  size?: "sm" | "md" | "default" | "lg" | "icon";
  align?: "start" | "end" | "center";
  onCreate?: () => void;
  iconOnly?: boolean;
  label?: string;
  showLeadingIcon?: boolean;
}) {
  return (
    <Button
      className={className}
      size={size}
      type="button"
      onClick={onCreate}
      aria-label={iconOnly ? (label ?? "Create new plan") : undefined}
    >
      {iconOnly || !showLeadingIcon ? null : <Plus className="mr-1.5 h-4 w-4" />}
      {iconOnly ? null : label}
    </Button>
  );
}

function AppSidebar({
  section,
  onCreatePlan,
  selectedEventId,
  totalPendingNotifications,
  displayPendingCount,
  onOpenNotifications,
  onOpenAccount,
  onOpenSettings,
}: {
  section: AppSection;
  onCreatePlan: () => void;
  selectedEventId?: number | null;
  totalPendingNotifications: number;
  displayPendingCount: string;
  onOpenNotifications: () => void;
  onOpenAccount: () => void;
  onOpenSettings: () => void;
}) {
  const [, setLocation] = useLocation();
  const { prefetchPlan, prefetchPlanOnHover, cancelHoverPrefetch } = usePrefetchPlan();
  const { data: events = [], isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useBarbecues();
  const { user } = useAuth();
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);
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
  const runningEvents = useMemo(
    () => allSortedEvents.filter((event) => isRunningPlan(event)),
    [allSortedEvents],
  );
  const archivedEvents = useMemo(
    () => allSortedEvents.filter((event) => isArchivedPlan(event)),
    [allSortedEvents],
  );

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
    if (recentOpenedIds.length === 0) return runningEvents.slice(0, 12);
    const byId = new Map(runningEvents.map((event) => [event.id, event]));
    const fromHistory = recentOpenedIds.map((id) => byId.get(id)).filter((event): event is BarbecueListItem => !!event);
    if (fromHistory.length >= 8) return fromHistory.slice(0, 12);
    const existingIds = new Set(fromHistory.map((e) => e.id));
    return [...fromHistory, ...runningEvents.filter((e) => !existingIds.has(e.id))].slice(0, 12);
  }, [recentOpenedIds, runningEvents]);

  const searchedEvents = recentEvents;

  const pinnedEventIds = useMemo(() => {
    const ids = new Set<number>();
    pinGroups.forEach((group) => group.eventIds.forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [pinGroups]);
  const pinnedEvents = useMemo(
    () => pinnedEventIds.map((id) => eventById.get(id)).filter((event): event is BarbecueListItem => !!event).slice(0, 8),
    [pinnedEventIds, eventById],
  );

  const advancedUnsettled = useMemo(
    () => runningEvents.filter((event) => event.status !== "settled").slice(0, 8),
    [runningEvents],
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

  const renderEventList = (list: BarbecueListItem[], emptyMessage: string, limit = 12) => (
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
          (() => {
            const isSelected = Number(selectedEventId) === Number(event.id);
            const content = (
              <div className="flex items-start gap-2">
                <span className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${getSidebarEventDotClass(event)}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{event.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {formatEventLocation(event)}
                  </p>
                </div>
                {Number((event as { unreadCount?: number }).unreadCount ?? 0) > 0 ? (
                  (() => {
                    const unread = Number((event as { unreadCount?: number }).unreadCount ?? 0);
                    const singleDigit = unread < 10;
                    return (
                      <span
                        className={singleDigit
                          ? "shrink-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                          : "shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"}
                      >
                        {unread}
                      </span>
                    );
                  })()
                ) : null}
              </div>
            );

            const baseClassName = `pointer-events-auto relative z-10 block rounded-xl border bg-background/40 px-3 py-2 text-sm transition ${
              isSelected
                ? "cursor-default border-primary/30 bg-primary/10 pl-[10px] before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                : "border-border/50 hover:border-border/70 hover:bg-muted/50"
            }`;

            if (isSelected) {
              return (
                <div
                  key={`sidebar-event-${event.id}`}
                  aria-current="page"
                  className={baseClassName}
                >
                  {content}
                </div>
              );
            }

            return (
              <a
                key={`sidebar-event-${event.id}`}
                href={`/app/e/${event.id}`}
                className={baseClassName}
                onMouseEnter={() => {
                  const planId = Number(event.id);
                  if (!Number.isFinite(planId)) return;
                  prefetchPlanOnHover(planId);
                }}
                onMouseLeave={() => {
                  const planId = Number(event.id);
                  if (!Number.isFinite(planId)) return;
                  cancelHoverPrefetch(planId);
                }}
                onFocus={() => {
                  const planId = Number(event.id);
                  if (!Number.isFinite(planId)) return;
                  prefetchPlan(planId);
                }}
                onTouchStart={() => {
                  const planId = Number(event.id);
                  if (!Number.isFinite(planId)) return;
                  prefetchPlan(planId);
                }}
              >
                {content}
              </a>
            );
          })()
        ))
      )}
    </div>
  );

  return (
    <aside className="group/sidebar hidden lg:flex w-64 lg:shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="h-screen w-full flex flex-col">
        <div className="shrink-0 border-b border-border/60 px-4 py-5">
          <Link href="/app/private">
            <a className="flex h-14 w-full items-center overflow-hidden">
              <SplannOLogo className="h-12 w-auto max-w-full" />
            </a>
          </Link>
        </div>
        <div className="shrink-0 px-3 pt-3 pb-2">
          <TooltipProvider delayDuration={100}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <NewEventMenuButton
                  className="w-full flex-1 rounded-full border border-primary/80 bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:brightness-95"
                  size="default"
                  align="start"
                  onCreate={onCreatePlan}
                  label="New Plan +"
                  showLeadingIcon={false}
                />
              </div>
            </div>
          </TooltipProvider>
          <div className="mx-0 my-2 h-px bg-border/60" />
        </div>

        <div className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
          <div className="h-full min-h-0 flex flex-col gap-3">
            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border/60 bg-card/70">
              <div className="shrink-0 border-b border-border/50 p-2">
                <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Your plans</p>
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
                    <p className="text-xs text-muted-foreground">Running Plans</p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{searchedEvents.length}</span>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={recentCollapsed ? "Expand running plans" : "Collapse running plans"}
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
                            const groupEvents = group.eventIds.map((id) => eventById.get(id)).filter((event): event is BarbecueListItem => !!event);
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
                {archivedEvents.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Archived · {archivedEvents.length}
                      </p>
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                        onClick={() => setArchivedCollapsed((v) => !v)}
                        aria-label={archivedCollapsed ? "Show archived plans" : "Hide archived plans"}
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${archivedCollapsed ? "" : "rotate-180"}`} />
                      </button>
                    </div>
                    {!archivedCollapsed && (
                      <div className="space-y-1 opacity-60">
                        {renderEventList(archivedEvents, "No archived plans")}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </section>
          </div>
        </div>

        <div className="relative z-30 mt-auto shrink-0 border-t border-border/50 bg-background px-3 py-3 pointer-events-auto">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenAccount}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar className="h-9 w-9 border border-border/60">
                {(user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.profileImageUrl
                  || (user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.avatarUrl ? (
                  <AvatarImage
                    src={
                      resolveAssetUrl(
                        ((user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.profileImageUrl)
                        || ((user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.avatarUrl)
                        || null,
                      ) ?? undefined
                    }
                    alt={user?.username || "Profile"}
                  />
                ) : null}
                <AvatarFallback className="text-xs font-semibold">
                  {String(user?.username || user?.email || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 text-left">
                <span className="block truncate text-sm font-medium text-foreground">
                  {user?.username || user?.email || "Profile"}
                </span>
                {(user as { isOnline?: boolean } | null)?.isOnline ? (
                  <span className="block text-xs text-muted-foreground">Online</span>
                ) : null}
              </span>
            </button>
        <div className="relative z-30 flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className={`relative inline-flex h-9 w-9 items-center justify-center ${circularActionButtonClass()}`}
                aria-label="Open notifications"
                onClick={onOpenNotifications}
              >
                <Bell className="h-[18px] w-[18px]" />
                {totalPendingNotifications > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {displayPendingCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={`inline-flex h-9 w-9 items-center justify-center pointer-events-auto ${circularActionButtonClass()}`}
                aria-label="Open settings"
                onClick={onOpenSettings}
              >
                <Settings className="h-[18px] w-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function RightActionRail({
  section,
  selectedEventId,
}: {
  section: AppSection;
  selectedEventId?: number | null;
}) {
  const [, setLocation] = useLocation();
  const { panel, closePanel, openPanel } = usePanel();
  const isEvent = section === "event" && !!selectedEventId;
  const isOverviewOpen = isEvent && panel?.type === "overview";
  const isPhotosOpen = isEvent && panel?.type === "photos";
  const isPollsOpen = isEvent && panel?.type === "polls";
  const isCrewOpen = isEvent && panel?.type === "crew";
  const isExpensesOpen = isEvent && panel?.type === "expenses";
  const isNotesOpen = isEvent && panel?.type === "notes";
  const isNextActionOpen = isEvent && panel?.type === "next-action";
  const railButtonClass = (active: boolean) =>
    `${circularActionButtonClass(active)} inline-flex h-10 w-10 items-center justify-center ${isEvent ? "" : "pointer-events-none opacity-45"}`;
  return (
    <aside className="pointer-events-none hidden w-16 shrink-0 py-4 lg:flex lg:items-center lg:justify-center">
      <div className="pointer-events-auto inline-flex flex-col items-center gap-2 rounded-2xl border border-border/50 border-l bg-background/80 p-2 shadow-lg backdrop-blur-md">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            title="Overview"
            aria-label="Overview"
            disabled={!isEvent}
            className={railButtonClass(isOverviewOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "overview" });
            }}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Crew"
            aria-label="Crew"
            disabled={!isEvent}
            className={railButtonClass(isCrewOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "crew" });
            }}
          >
            <Users className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Photos"
            aria-label="Photos"
            disabled={!isEvent}
            className={railButtonClass(isPhotosOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "photos" });
            }}
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Expenses"
            aria-label="Expenses"
            disabled={!isEvent}
            className={railButtonClass(isExpensesOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "expenses" });
            }}
          >
            <Receipt className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Votes"
            aria-label="Votes"
            disabled={!isEvent}
            className={railButtonClass(isPollsOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "polls" });
            }}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Notes"
            aria-label="Notes"
            disabled={!isEvent}
            className={railButtonClass(isNotesOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "notes" });
            }}
          >
            <StickyNote className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Next action"
            aria-label="Next action"
            disabled={!isEvent}
            className={railButtonClass(isNextActionOpen)}
            onClick={() => {
              if (!isEvent) return;
              openPanel({ type: "next-action" });
            }}
          >
            <Zap className="h-4 w-4" />
          </button>
        </div>
      </div>
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
                    {formatPlanDateRange(event.startDate, event.endDate, event.date) ?? "Date TBA"}
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
  const prefersReducedMotion = useReducedMotion();
  const [location, setLocation] = useLocation();
  const { closePanel } = usePanel();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const { openNewPlanWizard } = useNewPlanWizard();
  const { data: appEvents = [], isLoading: isLoadingEvents, error: eventsError } = useBarbecues();
  const {
    data: notificationsPayload,
    refetch: refetchNotifications,
    dataUpdatedAt: notificationsUpdatedAt,
  } = useNotifications(!!user);
  const acceptFriendRequest = useAcceptFriendRequestNotification();
  const declineFriendRequest = useDeclineFriendRequestNotification();
  const acceptPlanInvite = useAcceptPlanInvite();
  const declinePlanInvite = useDeclinePlanInvite();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileRecentCollapsed, setMobileRecentCollapsed] = useState(false);
  const [mobileArchivedCollapsed, setMobileArchivedCollapsed] = useState(true);
  const { prefetchPlan, prefetchPlanOnHover, cancelHoverPrefetch } = usePrefetchPlan();

  const pathname = typeof window !== "undefined" ? window.location.pathname : (location.split("?")[0] || "/app");
  const search = typeof window !== "undefined" ? window.location.search : "";
  const devDisable = useMemo(() => parseDevDisableFlags(search), [search]);
  useEffect(() => {
    if (!isAuthLoading && !user) setLocation("/login");
  }, [user, isAuthLoading, setLocation]);

  const privateEvents = useMemo(
    () => appEvents.filter((event) => isPrivateEvent(event)),
    [appEvents],
  );
  const recentOpenedStorageKey = useMemo(
    () => `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const preferredEventId = useMemo(() => {
    const byId = new Map<number, Barbecue>();
    for (const event of privateEvents) {
      const id = toEventId(event.id);
      if (id != null) byId.set(id, event);
    }
    if (typeof window !== "undefined") {
      try {
        const lastPlanId = Number(localStorage.getItem(LAST_PLAN_STORAGE_KEY));
        if (Number.isInteger(lastPlanId) && byId.has(lastPlanId)) return lastPlanId;
      } catch {
        // ignore malformed local storage
      }
      try {
        const raw = JSON.parse(localStorage.getItem(recentOpenedStorageKey) ?? "[]");
        const ids = Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
        const fromRecent = ids.find((id) => byId.has(id));
        if (fromRecent != null) return fromRecent;
      } catch {
        // ignore malformed local storage
      }
    }
    const mostRecentActive = [...privateEvents].sort((a, b) => {
      const aLast = new Date(String((a as unknown as { lastActivityAt?: string | null }).lastActivityAt ?? a.updatedAt ?? a.date ?? "")).getTime();
      const bLast = new Date(String((b as unknown as { lastActivityAt?: string | null }).lastActivityAt ?? b.updatedAt ?? b.date ?? "")).getTime();
      const aSafe = Number.isFinite(aLast) ? aLast : getEventCreatedMs(a);
      const bSafe = Number.isFinite(bLast) ? bLast : getEventCreatedMs(b);
      return bSafe - aSafe;
    })[0];
    return mostRecentActive ? toEventId(mostRecentActive.id) : null;
  }, [privateEvents, recentOpenedStorageKey]);

  useEffect(() => {
    if (pathname !== "/app/home") return;
    setLocation("/app/private", { replace: true });
  }, [pathname, setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("new") !== "private") return;
    openNewPlanWizard("TYPE");
    url.searchParams.delete("new");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [location, openNewPlanWizard]);

  let section: AppSection = "home";
  let routeEventId: number | null = null;
  if (pathname.startsWith("/app/e/")) {
    section = "event";
    const afterPrefix = pathname.split("/app/e/")[1] ?? "";
    const raw = afterPrefix.split("/")[0];
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
    if (typeof window === "undefined") return;
    const hasInvalidEventRoute = section === "event" && (!routeEventId || routeEventId <= 0);
    const shouldRedirectFromNoSelection = pathname === "/app" || hasInvalidEventRoute;
    if (!shouldRedirectFromNoSelection) return;
    const url = new URL(window.location.href);
    const eventIdParam = Number(url.searchParams.get("eventId"));
    if (Number.isFinite(eventIdParam) && eventIdParam > 0) {
      setLocation(`/app/e/${eventIdParam}${url.search || ""}`, { replace: true });
      return;
    }
    if (isLoadingEvents) return;
    if (preferredEventId) {
      setLocation(`/app/e/${preferredEventId}${url.search || ""}`, { replace: true });
      return;
    }
    if (pathname === "/app") {
      setLocation(`/app/private${url.search || ""}`, { replace: true });
    }
  }, [pathname, section, routeEventId, setLocation, isLoadingEvents, preferredEventId]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname, search]);

  useEffect(() => {
    closePanel();
  }, [pathname, search, closePanel]);

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
    if (!isSidebarOpen) {
      document.body.style.overflow = "";
      return;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (section !== "event" || !routeEventId || routeEventId <= 0) return;
    localStorage.setItem(LAST_PLAN_STORAGE_KEY, String(routeEventId));
  }, [section, routeEventId]);

  useEffect(() => {
    if (section !== "event" || !routeEventId || routeEventId <= 0) return;
    startPlanSwitchPerf(routeEventId, "route");
    prefetchPlan(routeEventId);
  }, [prefetchPlan, routeEventId, section]);

  const mobileQuickSwitchEvents = useMemo(() => {
    const sorted = [...appEvents].filter((event) => isPrivateEvent(event)).sort((a, b) => getEventDateMs(b) - getEventDateMs(a));
    return sorted.filter((event) => isRunningPlan(event)).slice(0, 8);
  }, [appEvents]);
  const mobileArchivedEvents = useMemo(
    () => [...appEvents]
      .filter((event) => isPrivateEvent(event) && isArchivedPlan(event))
      .sort((a, b) => getEventDateMs(b) - getEventDateMs(a)),
    [appEvents],
  );

  const currentEventName = useMemo(() => {
    if (section !== "event" || !routeEventId) return null;
    return appEvents.find((e) => toEventId(e.id) === routeEventId)?.name ?? null;
  }, [section, routeEventId, appEvents]);

  useEffect(() => {
    if (section !== "event" || !routeEventId) return;
    if (isLoadingEvents) return;
    const removeStaleRecentReference = () => {
      if (typeof window !== "undefined") {
        const key = `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`;
        try {
          const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
          const ids = Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
          const next = ids.filter((id) => id !== routeEventId);
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore malformed local state
        }
      }
    };

    if (eventsError) {
      removeStaleRecentReference();
      setLocation("/app/private", { replace: true });
      return;
    }

    const event = appEvents.find((candidate) => toEventId(candidate.id) === routeEventId);
    if (!event) {
      removeStaleRecentReference();
      setLocation("/app/private", { replace: true });
      return;
    }
    if (!isPrivateEvent(event)) {
      removeStaleRecentReference();
      setLocation("/app/private", { replace: true });
    }
  }, [section, routeEventId, appEvents, eventsError, isLoadingEvents, setLocation, user?.id, user?.username]);

  const mobileSectionLabel = section === "event"
    ? (currentEventName ?? "Event")
    : section === "private"
      ? "Private"
      : "Home";

  useEffect(() => {
    if (!notifOpen || !user) return;
    const isStale = Date.now() - notificationsUpdatedAt > 30_000;
    if (isStale) {
      void refetchNotifications();
    }
  }, [notifOpen, notificationsUpdatedAt, refetchNotifications, user]);

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
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Redirecting...
        </div>
      </div>
    );
  }
  const pendingFriendRequests = notificationsPayload?.friendRequests ?? [];
  const pendingPlanInvites = notificationsPayload?.planInvites ?? [];
  const totalPendingNotifications = pendingFriendRequests.length + pendingPlanInvites.length;
  const displayPendingCount = totalPendingNotifications > 9 ? "9+" : String(totalPendingNotifications);

  const anyKillActive = devDisable.headerPrefs || devDisable.discoverModal || devDisable.homeEffects;
  const handleOpenNewPlan = () => {
    openNewPlanWizard("TYPE");
  };
  const handleOpenAccount = () => {
    if (section === "home") {
      setLocation("/app/private");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("splanno:open-account"));
      });
      return;
    }
    window.dispatchEvent(new Event("splanno:open-account"));
  };
  const handleOpenAccountSettings = () => {
    if (section === "home") {
      setLocation("/app/private");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("splanno:open-account-settings"));
      });
      return;
    }
    window.dispatchEvent(new Event("splanno:open-account-settings"));
  };
  const getInitials = (displayName: string | null, username: string) => {
    const source = (displayName ?? username).trim();
    if (!source) return "?";
    const tokens = source.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  };
  const formatInviteMeta = (eventId: number) => {
    const event = appEvents.find((candidate) => candidate.id === eventId);
    if (!event) return null;
    const dateLabel = formatPlanDateRange(event.startDate, event.endDate, event.date);
    const locationLabel = formatEventLocation(event);
    if (!dateLabel && !locationLabel) return null;
    if (dateLabel && locationLabel) return `${dateLabel} · ${locationLabel}`;
    return dateLabel ?? locationLabel;
  };

  const mainContent = (
    <div className={section === "event"
      ? "h-screen overflow-hidden bg-background lg:flex lg:bg-primary/10"
      : "min-h-screen bg-background lg:flex lg:h-screen lg:overflow-hidden lg:bg-primary/10"}
    >
        <header className="sticky top-0 z-30 h-12 border-b border-border/60 bg-background/92 shadow-[0_6px_18px_rgba(15,23,42,0.05)] backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:hidden">
          <div className="flex h-full items-center justify-between gap-2 px-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-2xl border border-border/60 bg-background/75 shadow-sm active:scale-[0.98]"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0 flex-1 px-1">
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">{mobileSectionLabel}</p>
              {section === "event" ? (
                <p className="truncate text-[10px] leading-tight text-muted-foreground/90">Chat-first planning</p>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-2xl border border-border/60 bg-background/75 shadow-sm active:scale-[0.98]"
                aria-label="Open notifications"
                onClick={() => setNotifOpen(true)}
              >
                <Bell className="h-5 w-5" />
                {totalPendingNotifications > 0 && (
                  <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {displayPendingCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </header>

        <AnimatePresence>
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <motion.button
              type="button"
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
              aria-label="Close navigation drawer"
              onClick={() => setIsSidebarOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0.12 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            />
            <motion.aside
              className="absolute left-0 top-0 flex h-full w-[86vw] max-w-sm flex-col overflow-hidden border-r border-border/60 bg-[linear-gradient(180deg,hsl(var(--surface-1)),hsl(var(--surface-0)))] shadow-[0_18px_48px_rgba(15,23,42,0.22)]"
              initial={prefersReducedMotion ? { opacity: 1 } : { x: -28, opacity: 0.96, scale: 0.985 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { x: -24, opacity: 0.98, scale: 0.99 }}
              transition={prefersReducedMotion ? { duration: 0.14 } : { type: "spring", stiffness: 340, damping: 34, mass: 0.9 }}
            >
              <div className="flex items-center justify-between px-5 pb-4 pt-5">
                <Link href="/app/private">
                  <a className="flex min-h-10 flex-1 items-center overflow-hidden pr-3">
                    <SplannOLogo className="h-10 w-auto max-w-full" />
                  </a>
                </Link>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/60 bg-background/70" onClick={() => setIsSidebarOpen(false)} aria-label="Close drawer">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="shrink-0 px-4 pb-4">
                <NewEventMenuButton
                  className="h-12 w-full justify-start rounded-full border border-primary/70 bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(245,166,35,0.22)]"
                  align="start"
                  onCreate={() => {
                    setIsSidebarOpen(false);
                    handleOpenNewPlan();
                  }}
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                <div className="space-y-4 pr-1">
                  <div className="rounded-[22px] border border-border/60 bg-card/75 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Running Plans</p>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label={mobileRecentCollapsed ? "Expand running plans" : "Collapse running plans"}
                      aria-expanded={!mobileRecentCollapsed}
                      aria-controls="mobile-recent-events-list"
                      onClick={() => setMobileRecentCollapsed((v) => !v)}
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileRecentCollapsed ? "" : "rotate-180"}`} />
                    </button>
                  </div>
                  {mobileRecentCollapsed ? (
                    <p className="text-xs text-muted-foreground py-1">{mobileQuickSwitchEvents.length} hidden</p>
                  ) : mobileQuickSwitchEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No plans found</p>
                  ) : (
                    <div id="mobile-recent-events-list" className="space-y-2.5 pt-1">
                      {mobileQuickSwitchEvents.map((event) => (
                        <Link key={`mobile-event-${event.id}`} href={`/app/e/${event.id}`}>
                          <a
                            onClick={() => setIsSidebarOpen(false)}
                            onMouseEnter={() => {
                              const planId = Number(event.id);
                              if (!Number.isFinite(planId)) return;
                              prefetchPlanOnHover(planId);
                            }}
                            onMouseLeave={() => {
                              const planId = Number(event.id);
                              if (!Number.isFinite(planId)) return;
                              cancelHoverPrefetch(planId);
                            }}
                            onFocus={() => {
                              const planId = Number(event.id);
                              if (!Number.isFinite(planId)) return;
                              prefetchPlan(planId);
                            }}
                            onTouchStart={() => {
                              const planId = Number(event.id);
                              if (!Number.isFinite(planId)) return;
                              prefetchPlan(planId);
                            }}
                            className={`relative block rounded-[20px] border bg-background/85 px-3.5 py-3.5 transition active:scale-[0.995] hover:bg-muted/20 ${
                              Number(routeEventId) === Number(event.id)
                                ? "border-primary/35 bg-primary/10 pl-[15px] shadow-[0_10px_24px_rgba(245,166,35,0.12)] before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                                : "border-border/60"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${getSidebarEventDotClass(event)}`} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[14px] font-medium">{event.name}</p>
                                <p className="mt-1 truncate text-[12px] text-muted-foreground">
                                  {formatEventLocation(event)}
                                </p>
                              </div>
                              {Number((event as { unreadCount?: number }).unreadCount ?? 0) > 0 ? (
                                (() => {
                                  const unread = Number((event as { unreadCount?: number }).unreadCount ?? 0);
                                  const singleDigit = unread < 10;
                                  return (
                                    <span
                                      className={singleDigit
                                        ? "shrink-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                                        : "shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"}
                                    >
                                      {unread}
                                    </span>
                                  );
                                })()
                              ) : null}
                            </div>
                          </a>
                        </Link>
                      ))}
                    </div>
                  )}
                  </div>
                  {mobileArchivedEvents.length > 0 && (
                    <div className="rounded-[22px] border border-border/60 bg-card/60 p-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Archived · {mobileArchivedEvents.length}</p>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          aria-label={mobileArchivedCollapsed ? "Show archived plans" : "Hide archived plans"}
                          onClick={() => setMobileArchivedCollapsed((v) => !v)}
                        >
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileArchivedCollapsed ? "" : "rotate-180"}`} />
                        </button>
                      </div>
                      {!mobileArchivedCollapsed && (
                        <div className="space-y-2.5 pt-1 opacity-70">
                          {mobileArchivedEvents.map((event) => (
                            <Link key={`mobile-archived-event-${event.id}`} href={`/app/e/${event.id}`}>
                              <a
                                onClick={() => setIsSidebarOpen(false)}
                                onMouseEnter={() => {
                                  const planId = Number(event.id);
                                  if (!Number.isFinite(planId)) return;
                                  prefetchPlanOnHover(planId);
                                }}
                                onMouseLeave={() => {
                                  const planId = Number(event.id);
                                  if (!Number.isFinite(planId)) return;
                                  cancelHoverPrefetch(planId);
                                }}
                                onFocus={() => {
                                  const planId = Number(event.id);
                                  if (!Number.isFinite(planId)) return;
                                  prefetchPlan(planId);
                                }}
                                onTouchStart={() => {
                                  const planId = Number(event.id);
                                  if (!Number.isFinite(planId)) return;
                                  prefetchPlan(planId);
                                }}
                                className={`relative block rounded-[20px] border bg-background/80 px-3.5 py-3.5 transition active:scale-[0.995] hover:bg-muted/20 ${
                                  Number(routeEventId) === Number(event.id)
                                    ? "border-primary/30 bg-primary/10 pl-[15px] before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                                    : "border-border/60"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${getSidebarEventDotClass(event)}`} />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[14px] font-medium">{event.name}</p>
                                    <p className="mt-1 truncate text-[12px] text-muted-foreground">
                                      {formatEventLocation(event)}
                                    </p>
                                  </div>
                                  {Number((event as { unreadCount?: number }).unreadCount ?? 0) > 0 ? (
                                    (() => {
                                      const unread = Number((event as { unreadCount?: number }).unreadCount ?? 0);
                                      const singleDigit = unread < 10;
                                      return (
                                        <span
                                          className={singleDigit
                                            ? "shrink-0 grid h-5 w-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                                            : "shrink-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"}
                                        >
                                          {unread}
                                        </span>
                                      );
                                    })()
                                  ) : null}
                                </div>
                              </a>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="shrink-0 border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 rounded-[20px] border border-border/60 bg-card/80 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSidebarOpen(false);
                      handleOpenAccount();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-9 w-9 border border-border/60">
                      {(user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.profileImageUrl
                        || (user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.avatarUrl ? (
                        <AvatarImage
                          src={
                            resolveAssetUrl(
                              ((user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.profileImageUrl)
                              || ((user as { profileImageUrl?: string | null; avatarUrl?: string | null } | null)?.avatarUrl)
                              || null,
                            ) ?? undefined
                          }
                          alt={user?.username || "Profile"}
                        />
                      ) : null}
                      <AvatarFallback className="text-xs font-semibold">
                        {String(user?.username || user?.email || "U").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 text-left">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {user?.username || user?.email || "Profile"}
                      </span>
                      {(user as { isOnline?: boolean } | null)?.isOnline ? (
                        <span className="block text-xs text-muted-foreground">Online</span>
                      ) : null}
                    </span>
                  </button>
                    <div className="relative z-30 flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      className={`relative inline-flex h-9 w-9 items-center justify-center ${circularActionButtonClass()}`}
                      aria-label="Open notifications"
                      onClick={() => {
                        setIsSidebarOpen(false);
                        setNotifOpen(true);
                      }}
                    >
                      <Bell className="h-[18px] w-[18px]" />
                      {totalPendingNotifications > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                          {displayPendingCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-9 w-9 items-center justify-center pointer-events-auto ${circularActionButtonClass()}`}
                      aria-label="Open settings"
                      onClick={() => {
                        setIsSidebarOpen(false);
                        handleOpenAccountSettings();
                      }}
                    >
                      <Settings className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
        </AnimatePresence>

        <AppSidebar
          section={section}
          onCreatePlan={handleOpenNewPlan}
          selectedEventId={routeEventId ?? null}
          totalPendingNotifications={totalPendingNotifications}
          displayPendingCount={displayPendingCount}
          onOpenNotifications={() => setNotifOpen(true)}
          onOpenAccount={handleOpenAccount}
          onOpenSettings={handleOpenAccountSettings}
        />
        <main className={`min-w-0 flex-1 ${section === "event" ? "overflow-hidden" : "min-h-0 overflow-y-auto overscroll-y-contain"}`}>
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
        {section === "event" ? (
          <RightActionRail
            section={section}
            selectedEventId={routeEventId ?? null}
          />
        ) : null}
        <NewPlanWizardDrawer />
        <Sheet open={notifOpen} onOpenChange={setNotifOpen}>
          <SheetContent side="right" className="w-full max-w-sm p-0">
            <div className="flex h-full flex-col">
              <SheetHeader className="border-b border-border/60 px-4 py-3 text-left">
                <SheetTitle className="text-base">Notifications</SheetTitle>
                <SheetDescription>Friend requests and plan invites</SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <section className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-sm font-medium">Friend requests</p>
                  {pendingFriendRequests.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No pending friend requests</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {pendingFriendRequests.map((request) => {
                        const isAccepting = acceptFriendRequest.isPending && acceptFriendRequest.variables === request.friendshipId;
                        const isDeclining = declineFriendRequest.isPending && declineFriendRequest.variables === request.friendshipId;
                        return (
                          <div key={`notif-friend-${request.friendshipId}`} className="flex items-center gap-2 rounded-lg border border-border/50 p-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-[10px]">
                                {getInitials(request.displayName, request.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{request.displayName ?? request.username}</p>
                              <p className="truncate text-[11px] text-muted-foreground">@{request.username}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={isAccepting || isDeclining}
                                onClick={() => {
                                  acceptFriendRequest.mutate(request.friendshipId, {
                                    onSuccess: () => {
                                      toast({ variant: "success", message: "Friend request accepted" });
                                    },
                                    onError: (error) => {
                                      toast({
                                        variant: "error",
                                        message: error instanceof Error ? error.message : "Could not accept friend request",
                                      });
                                    },
                                  });
                                }}
                              >
                                {isAccepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Accept"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={isAccepting || isDeclining}
                                onClick={() => {
                                  declineFriendRequest.mutate(request.friendshipId, {
                                    onSuccess: () => {
                                      toast({ variant: "success", message: "Friend request declined" });
                                    },
                                    onError: (error) => {
                                      toast({
                                        variant: "error",
                                        message: error instanceof Error ? error.message : "Could not decline friend request",
                                      });
                                    },
                                  });
                                }}
                              >
                                {isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Decline"}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                <section className="rounded-xl border border-border/60 bg-card p-3">
                  <p className="text-sm font-medium">Plan invites</p>
                  {pendingPlanInvites.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">No pending plan invites</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {pendingPlanInvites.map((invite) => {
                        const isAccepting = acceptPlanInvite.isPending && acceptPlanInvite.variables === invite.id;
                        const isDeclining = declinePlanInvite.isPending && declinePlanInvite.variables === invite.id;
                        const inviteMeta = formatInviteMeta(invite.eventId);
                        return (
                          <div key={`notif-plan-${invite.id}`} className="rounded-lg border border-border/50 p-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">{invite.eventName}</p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  Invited by {invite.inviterName ?? "Unknown user"}
                                </p>
                                {inviteMeta && (
                                  <p className="truncate text-[11px] text-muted-foreground">{inviteMeta}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  disabled={isAccepting || isDeclining}
                                  onClick={() => {
                                    acceptPlanInvite.mutate(invite.id, {
                                      onSuccess: () => {
                                        toast({ variant: "success", message: "Plan invite accepted" });
                                      },
                                      onError: (error) => {
                                        toast({
                                          variant: "error",
                                          message: error instanceof Error ? error.message : "Could not accept invite",
                                        });
                                      },
                                    });
                                  }}
                                >
                                  {isAccepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Accept"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  disabled={isAccepting || isDeclining}
                                  onClick={() => {
                                    declinePlanInvite.mutate(invite.id, {
                                      onSuccess: () => {
                                        toast({ variant: "success", message: "Plan invite declined" });
                                      },
                                      onError: (error) => {
                                        toast({
                                          variant: "error",
                                          message: error instanceof Error ? error.message : "Could not decline invite",
                                        });
                                      },
                                    });
                                  }}
                                >
                                  {isDeclining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Decline"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </SheetContent>
        </Sheet>
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
