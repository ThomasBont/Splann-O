import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBarbecues, useCheckoutPublicListing, useUpdateBarbecue } from "@/hooks/use-bbq-data";
import Home from "@/pages/home";
import ExplorePage from "@/pages/explore";
import {
  Loader2,
  Home as HomeIcon,
  Lock,
  Globe,
  Compass,
  Plus,
  Copy,
  Pin,
  PinOff,
  ExternalLink,
  Megaphone,
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
import { useToast } from "@/hooks/use-toast";
import { loadLocalUserPreferences } from "@/lib/user-preferences";
import { copyText } from "@/lib/copy-text";
import { EventHeaderPreferencesProvider, useEventHeaderPreferences } from "@/hooks/use-event-header-preferences";
import { DEFAULT_EVENT_HEADER_PREFERENCES, type UtilityAction } from "@/lib/event-header-preferences";
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
  const { user } = useAuth();
  const {
    effectivePrefs: effectiveHeaderPrefs,
    beginDraft: beginHeaderPrefsDraft,
    updateDraft: updateHeaderPrefsDraft,
    cancelDraft: cancelHeaderPrefsDraft,
    saveDraft: saveHeaderPrefsDraft,
  } = useEventHeaderPreferences();
  const [search, setSearch] = useState("");
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [layout, setLayout] = useState<SidebarLayout>(() => defaultSidebarLayout());
  const [draftLayout, setDraftLayout] = useState<SidebarLayout | null>(null);
  const [pinGroups, setPinGroups] = useState<PinGroup[]>(() => defaultPinGroups());
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [addSmartKind, setAddSmartKind] = useState<SmartSectionKind>("UPCOMING");
  const resizeState = useRef<{ sectionId: string; startY: number; startHeight: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  const layoutKey = useMemo(
    () => `splanno.sidebar.layout.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const pinGroupsKey = useMemo(
    () => `splanno.sidebar.pin-groups.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );
  const recentOpenedKey = useMemo(
    () => `splanno.sidebar.recent-opened.v1:${user?.id ?? user?.username ?? "anon"}`,
    [user?.id, user?.username],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawLayout = localStorage.getItem(layoutKey);
    const rawGroups = localStorage.getItem(pinGroupsKey);
    setLayout(sanitizeSidebarLayout(rawLayout ? JSON.parse(rawLayout) : null));
    setPinGroups(sanitizePinGroups(rawGroups ? JSON.parse(rawGroups) : null));
    loadedRef.current = true;
  }, [layoutKey, pinGroupsKey]);

  useEffect(() => {
    if (!loadedRef.current || typeof window === "undefined") return;
    const timeout = window.setTimeout(() => {
      localStorage.setItem(layoutKey, JSON.stringify(layout));
      localStorage.setItem(pinGroupsKey, JSON.stringify(pinGroups));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [layout, pinGroups, layoutKey, pinGroupsKey]);

  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const allSortedEvents = useMemo(() => [...events].sort((a, b) => getEventDateMs(b) - getEventDateMs(a)), [events]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSortedEvents.slice(0, 40);
    return allSortedEvents.filter((event) => {
      const location = `${event.city ?? ""} ${event.countryName ?? ""} ${event.locationName ?? ""}`;
      return event.name.toLowerCase().includes(q) || location.toLowerCase().includes(q);
    }).slice(0, 40);
  }, [allSortedEvents, search]);

  const recentOpenedIds = useMemo(() => {
    if (typeof window === "undefined") return [] as number[];
    try {
      const raw = JSON.parse(localStorage.getItem(recentOpenedKey) ?? "[]");
      return Array.isArray(raw) ? raw.filter((id): id is number => Number.isInteger(id)) : [];
    } catch {
      return [];
    }
  }, [recentOpenedKey, events.length]);

  // IMPORTANT: Sidebar previews draft changes live while modal is open.
  // effectiveLayout = draftLayout ?? layout
  const effectiveLayout = draftLayout ?? layout;
  const widthClass = effectiveLayout.width === "compact" ? "w-56" : effectiveLayout.width === "wide" ? "w-80" : "w-64";

  const items: Array<{ href: string; label: string; icon: ComponentType<{ className?: string }> ; key: AppSection | "explore" }> = [
    { href: "/app/home", label: "Home", icon: HomeIcon, key: "home" },
    { href: "/app/private", label: "Private", icon: Lock, key: "private" },
    { href: "/app/public", label: "Public", icon: Globe, key: "public" },
    { href: "/app/explore", label: "Explore", icon: Compass, key: "explore" },
  ];

  const mutateLayout = (updater: (prev: SidebarLayout) => SidebarLayout) => {
    if (draftLayout) {
      setDraftLayout((prev) => sanitizeSidebarLayout(updater(prev ?? layout)));
      return;
    }
    setLayout((prev) => sanitizeSidebarLayout(updater(prev)));
  };

  const moveSection = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    mutateLayout((prev) => {
      const list = [...prev.sections];
      const fromIdx = list.findIndex((s) => s.id === fromId);
      const toIdx = list.findIndex((s) => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      return { ...prev, sections: list };
    });
  };

  const updateSection = (sectionId: string, patch: Partial<SidebarSectionConfig>) => {
    mutateLayout((prev) => ({
      ...prev,
      sections: prev.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section)),
    }));
  };

  const removeSection = (sectionId: string) => {
    mutateLayout((prev) => ({
      ...prev,
      sections: prev.sections.filter((section) => section.id !== sectionId),
    }));
  };

  const addSmartSection = (kind: SmartSectionKind) => {
    const id = `smart-${kind.toLowerCase()}-${Date.now()}`;
    mutateLayout((prev) => ({
      ...prev,
      sections: [...prev.sections, { id, type: "SMART", title: kind[0] + kind.slice(1).toLowerCase(), collapsed: false, heightPx: 180, props: { kind } }],
    }));
  };

  const pinEventToGroup = (eventId: number, groupId: string) => {
    setPinGroups((prev) =>
      prev.map((group) => {
        const without = group.eventIds.filter((id) => id !== eventId);
        if (group.id !== groupId) return { ...group, eventIds: without };
        return { ...group, eventIds: [...without, eventId] };
      }),
    );
  };

  const removePinnedEvent = (eventId: number) => {
    setPinGroups((prev) => prev.map((group) => ({ ...group, eventIds: group.eventIds.filter((id) => id !== eventId) })));
  };

  const createPinGroup = () => {
    const name = window.prompt("Group name", "New group");
    if (!name?.trim()) return;
    const id = `group-${Date.now()}`;
    setPinGroups((prev) => [...prev, { id, name: name.trim(), collapsed: false, eventIds: [] }]);
  };

  const renamePinGroup = (groupId: string) => {
    const current = pinGroups.find((group) => group.id === groupId);
    if (!current) return;
    const name = window.prompt("Rename group", current.name);
    if (!name?.trim()) return;
    setPinGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, name: name.trim() } : group)));
  };

  const deletePinGroup = (groupId: string) => {
    if (pinGroups.length <= 1) return;
    setPinGroups((prev) => prev.filter((group) => group.id !== groupId));
  };

  const smartEventsByKind = (kind: SmartSectionKind): Barbecue[] => {
    const now = new Date();
    if (kind === "RECENT") {
      const byId = new Map(allSortedEvents.map((event) => [event.id, event]));
      return recentOpenedIds.map((id) => byId.get(id)).filter((event): event is Barbecue => !!event).slice(0, 12);
    }
    if (kind === "UPCOMING") {
      const upper = new Date(now);
      upper.setDate(upper.getDate() + 14);
      return allSortedEvents.filter((event) => {
        if (!event.date) return false;
        const d = new Date(event.date as unknown as string);
        return d >= now && d <= upper;
      }).slice(0, 12);
    }
    if (kind === "DRAFTS") {
      return allSortedEvents.filter((event) => isPublicEvent(event) && event.visibility !== "public").slice(0, 12);
    }
    return allSortedEvents.filter((event) => isPrivateEvent(event) && event.status !== "settled").slice(0, 12);
  };

  const headerUtilityOrder = effectiveHeaderPrefs.utilityOrder;
  const headerUtilityHidden = effectiveHeaderPrefs.utilityHidden ?? {};
  const visibleHeaderCount = (["share", "calendar", "settings"] as UtilityAction[]).filter((action) => !headerUtilityHidden[action]).length;

  const moveHeaderUtility = (from: UtilityAction, to: UtilityAction) => {
    if (from === to) return;
    updateHeaderPrefsDraft((prev) => {
      const next = [...prev.utilityOrder];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      if (fromIdx < 0 || toIdx < 0) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      return { ...prev, utilityOrder: next };
    });
  };

  const toggleHeaderUtilityVisibility = (action: UtilityAction, checked: boolean) => {
    updateHeaderPrefsDraft((prev) => ({
      ...prev,
      utilityHidden: {
        ...(prev.utilityHidden ?? {}),
        [action]: !checked,
      },
    }));
  };

  const beginResize = (sectionId: string, startHeight: number, clientY: number) => {
    resizeState.current = { sectionId, startHeight, startY: clientY };
    const onMove = (ev: PointerEvent) => {
      const state = resizeState.current;
      if (!state) return;
      const nextHeight = Math.max(120, Math.min(520, state.startHeight + (ev.clientY - state.startY)));
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        updateSection(state.sectionId, { heightPx: nextHeight, collapsed: false });
      });
    };
    const onUp = () => {
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      resizeState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const renderEventList = (list: Barbecue[], withPin = false) => (
    <div className="space-y-1 pr-1">
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground px-1 py-1.5">No events found</p>
      ) : (
        list.map((event) => (
          <div
            key={`sidebar-event-${event.id}`}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData("application/x-splanno-event-id", String(event.id));
            }}
            className="rounded-md border border-transparent hover:border-border/60 hover:bg-muted/30"
          >
            <Link href={`/app/e/${event.id}`}>
              <a className="block px-2 py-1.5 text-xs">
                <p className="truncate font-medium">{event.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {isPublicEvent(event) ? "Public" : "Private"} · {formatEventLocation(event)}
                </p>
              </a>
            </Link>
            {withPin && (
              <div className="px-2 pb-1.5 flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePinnedEvent(event.id)}>
                  <PinOff className="h-3.5 w-3.5" />
                </Button>
                {pinGroups.map((group) => (
                  <Button
                    key={`pin-target-${group.id}-${event.id}`}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => pinEventToGroup(event.id, group.id)}
                  >
                    {group.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <aside className={`group/sidebar hidden lg:flex ${widthClass} lg:flex-col lg:shrink-0 border-r border-border/60 bg-card/40 backdrop-blur-sm`}>
      <div className="p-4 border-b border-border/60">
        <Link href="/app/home">
          <span className="text-sm font-semibold tracking-tight cursor-pointer">Splanno</span>
        </Link>
      </div>
      <nav className="p-3 space-y-1 shrink-0">
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
      <div className="border-t border-border/60 px-3 pt-3 pb-3 space-y-3 sticky top-0 bg-card/80 backdrop-blur-sm z-10 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full justify-start">
              <Plus className="h-4 w-4 mr-1.5" />
              New event
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem asChild>
              <Link href="/app/private?new=private">
                <a className="flex flex-col items-start py-2">
                  <span className="text-sm font-medium">Private event</span>
                  <span className="text-xs text-muted-foreground">Friends + split costs</span>
                </a>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/app/public?new=public">
                <a className="flex flex-col items-start py-2">
                  <span className="text-sm font-medium">Public event</span>
                  <span className="text-xs text-muted-foreground">Professional/public listing</span>
                </a>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Quick switch</p>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events..."
            className="h-8 text-xs"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            title="Customize sidebar"
            className="h-7 px-2 text-xs opacity-0 transition-opacity group-hover/sidebar:opacity-100 focus-visible:opacity-100"
            onClick={() => {
              setDraftLayout(structuredClone(layout));
              beginHeaderPrefsDraft();
              setCustomizeOpen(true);
            }}
          >
            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
            Customize
          </Button>
        </div>
      </div>
      <div className="px-3 pb-3 flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-2">
          {effectiveLayout.sections.map((sectionConfig) => {
            const sectionTitle =
              sectionConfig.title ??
              (sectionConfig.type === "PIN_GROUPS"
                ? "Pin groups"
                : sectionConfig.type === "QUICK_SWITCH"
                  ? "Quick switch"
                  : sectionConfig.props?.kind === "UPCOMING"
                    ? "Upcoming"
                    : sectionConfig.props?.kind === "DRAFTS"
                      ? "Drafts"
                      : sectionConfig.props?.kind === "UNSETTLED"
                        ? "Unsettled"
                        : "Recent");
            const collapsed = !!sectionConfig.collapsed;
            const height = sectionConfig.heightPx ?? (sectionConfig.type === "PIN_GROUPS" ? 160 : 280);
            return (
              <section
                key={sectionConfig.id}
                className="rounded-xl border border-border/60 bg-card/70"
                draggable
                onDragStart={() => setDraggingSectionId(sectionConfig.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!draggingSectionId) return;
                  moveSection(draggingSectionId, sectionConfig.id);
                }}
              >
                <div className="flex items-center justify-between px-2 py-2 border-b border-border/50">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                    <p className="text-xs font-semibold truncate">{sectionTitle}</p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => updateSection(sectionConfig.id, { collapsed: !collapsed })}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`} />
                  </Button>
                </div>
                {!collapsed && (
                  <div style={{ height }} className="overflow-y-auto p-2">
                    {sectionConfig.type === "QUICK_SWITCH" && renderEventList(filtered, true)}
                    {sectionConfig.type === "SMART" && renderEventList(smartEventsByKind(sectionConfig.props?.kind ?? "RECENT"))}
                    {sectionConfig.type === "PIN_GROUPS" && (
                      <div className="space-y-2">
                        {pinGroups.map((group) => {
                          const groupEvents = group.eventIds.map((id) => eventById.get(id)).filter((event): event is Barbecue => !!event);
                          return (
                            <div
                              key={group.id}
                              className="rounded-lg border border-border/50 p-2"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                const data = e.dataTransfer.getData("application/x-splanno-event-id");
                                const eventId = Number(data);
                                if (Number.isFinite(eventId)) pinEventToGroup(eventId, group.id);
                              }}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <button
                                  type="button"
                                  className="text-xs font-medium truncate text-left"
                                  onClick={() =>
                                    setPinGroups((prev) =>
                                      prev.map((item) => (item.id === group.id ? { ...item, collapsed: !item.collapsed } : item)),
                                    )
                                  }
                                >
                                  {group.name} <span className="text-muted-foreground">({groupEvents.length})</span>
                                </button>
                                <div className="flex items-center">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => renamePinGroup(group.id)}>
                                    <Settings2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-destructive"
                                    disabled={pinGroups.length <= 1}
                                    onClick={() => deletePinGroup(group.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              {!group.collapsed && (
                                <div className="mt-2 space-y-1">
                                  {groupEvents.length === 0 ? (
                                    <p className="text-[11px] text-muted-foreground">Drag events here</p>
                                  ) : (
                                    groupEvents.map((event) => (
                                      <div key={`${group.id}-${event.id}`} className="rounded-md border border-transparent hover:border-border/60 hover:bg-muted/30">
                                        <Link href={`/app/e/${event.id}`}>
                                          <a className="block px-2 py-1.5 text-xs">
                                            <p className="truncate font-medium">{event.name}</p>
                                            <p className="truncate text-[10px] text-muted-foreground">
                                              {isPublicEvent(event) ? "Public" : "Private"}
                                            </p>
                                          </a>
                                        </Link>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <Button size="sm" variant="outline" className="w-full" onClick={createPinGroup}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          New group
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div
                  className="h-2 cursor-row-resize hover:bg-muted/40"
                  onDoubleClick={() => updateSection(sectionConfig.id, { heightPx: sectionConfig.type === "PIN_GROUPS" ? 160 : 280 })}
                  onPointerDown={(e) => beginResize(sectionConfig.id, height, e.clientY)}
                />
              </section>
            );
          })}
        </div>
      </div>
      <Modal
        open={customizeOpen}
        onClose={() => {
          setDraftLayout(null);
          cancelHeaderPrefsDraft();
          setCustomizeOpen(false);
        }}
        onOpenChange={(open) => {
          setCustomizeOpen(open);
          if (!open) {
            setDraftLayout(null);
            cancelHeaderPrefsDraft();
          }
        }}
        title="Customize sidebar"
        size="md"
        scrollable
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Sidebar width</p>
            <div className="grid grid-cols-3 gap-2">
              {(["compact", "default", "wide"] as SidebarWidth[]).map((width) => (
                <Button
                  key={`sidebar-width-${width}`}
                  size="sm"
                  variant={effectiveLayout.width === width ? "default" : "outline"}
                  onClick={() => mutateLayout((prev) => ({ ...prev, width }))}
                >
                  {width}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sections</p>
            <div className="space-y-2">
              {effectiveLayout.sections.map((sectionConfig) => (
                <div key={`customize-${sectionConfig.id}`} className="rounded-lg border border-border/60 p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sectionConfig.title ?? sectionConfig.type}</p>
                    <p className="text-xs text-muted-foreground">Height: {sectionConfig.heightPx ?? 180}px</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={effectiveLayout.sections[0]?.id === sectionConfig.id} onClick={() => {
                      const idx = effectiveLayout.sections.findIndex((s) => s.id === sectionConfig.id);
                      if (idx <= 0) return;
                      const next = [...effectiveLayout.sections];
                      const [moved] = next.splice(idx, 1);
                      next.splice(idx - 1, 0, moved);
                      mutateLayout((prev) => ({ ...prev, sections: next }));
                    }}>
                      <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={effectiveLayout.sections[effectiveLayout.sections.length - 1]?.id === sectionConfig.id} onClick={() => {
                      const idx = effectiveLayout.sections.findIndex((s) => s.id === sectionConfig.id);
                      if (idx < 0 || idx === effectiveLayout.sections.length - 1) return;
                      const next = [...effectiveLayout.sections];
                      const [moved] = next.splice(idx, 1);
                      next.splice(idx + 1, 0, moved);
                      mutateLayout((prev) => ({ ...prev, sections: next }));
                    }}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    {sectionConfig.type === "SMART" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeSection(sectionConfig.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <p className="text-sm font-medium">Add smart section</p>
            <div className="flex gap-2">
              <select
                className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm"
                value={addSmartKind}
                onChange={(e) => setAddSmartKind(e.target.value as SmartSectionKind)}
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="RECENT">Recent</option>
                <option value="DRAFTS">Drafts</option>
                <option value="UNSETTLED">Unsettled</option>
              </select>
              <Button size="sm" onClick={() => addSmartSection(addSmartKind)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <p className="text-sm font-medium">Event header actions</p>
            <p className="text-xs text-muted-foreground">
              Reorder and choose which quick actions appear on event headers.
            </p>
            <div className="space-y-2">
              {headerUtilityOrder.map((action) => {
                const idx = headerUtilityOrder.indexOf(action);
                const isVisible = !headerUtilityHidden[action];
                const disableHide = isVisible && visibleHeaderCount <= 1;
                const label =
                  action === "share" ? "Share" : action === "calendar" ? "Add to Calendar" : "Settings";
                return (
                  <div
                    key={`header-utility-${action}`}
                    className="rounded-lg border border-border/60 p-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-sm font-medium truncate">{label}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx <= 0}
                        onClick={() => moveHeaderUtility(action, headerUtilityOrder[idx - 1] as UtilityAction)}
                      >
                        <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === headerUtilityOrder.length - 1}
                        onClick={() => moveHeaderUtility(action, headerUtilityOrder[idx + 1] as UtilityAction)}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                      <Switch
                        checked={isVisible}
                        disabled={disableHide}
                        onCheckedChange={(checked) => toggleHeaderUtilityVisibility(action, checked)}
                        aria-label={`Toggle ${label} visibility`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDraftLayout(defaultSidebarLayout());
                updateHeaderPrefsDraft(() => DEFAULT_EVENT_HEADER_PREFERENCES);
              }}
            >
              Reset
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDraftLayout(null);
                cancelHeaderPrefsDraft();
                setCustomizeOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (draftLayout) setLayout(sanitizeSidebarLayout(draftLayout));
                saveHeaderPrefsDraft();
                setDraftLayout(null);
                setCustomizeOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
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
  const { data: appEvents = [] } = useBarbecues();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mobileQuickSwitchSearch, setMobileQuickSwitchSearch] = useState("");

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

  const mobileQuickSwitchEvents = useMemo(() => {
    const q = mobileQuickSwitchSearch.trim().toLowerCase();
    const sorted = [...appEvents].sort((a, b) => getEventDateMs(b) - getEventDateMs(a));
    if (!q) return sorted.slice(0, 12);
    return sorted.filter((event) => {
      const locationText = `${event.city ?? ""} ${event.countryName ?? ""} ${event.locationName ?? ""}`;
      return event.name.toLowerCase().includes(q) || locationText.toLowerCase().includes(q);
    }).slice(0, 12);
  }, [appEvents, mobileQuickSwitchSearch]);

  const currentEventName = useMemo(() => {
    if (section !== "event" || !routeEventId) return null;
    return appEvents.find((e) => e.id === routeEventId)?.name ?? null;
  }, [section, routeEventId, appEvents]);

  const mobileSectionLabel = section === "event"
    ? (currentEventName ?? "Event")
    : section === "private"
      ? "Private"
      : section === "public"
        ? "Public"
        : section === "explore"
          ? "Explore"
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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <EventHeaderPreferencesProvider userKey={`${user?.id ?? user?.username ?? "anon"}`}>
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
                  { href: "/app/public", label: "Public", icon: Globe, key: "public" as AppSection },
                  { href: "/app/explore", label: "Explore", icon: Compass, key: "explore" as AppSection },
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
              <div className="border-t border-border/60 px-3 py-3 space-y-3 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-start">
                      <Plus className="h-4 w-4 mr-1.5" />
                      New event
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-72">
                    <DropdownMenuItem asChild>
                      <Link href="/app/private?new=private">
                        <a className="flex flex-col items-start py-2" onClick={() => setIsSidebarOpen(false)}>
                          <span className="text-sm font-medium">Private event</span>
                          <span className="text-xs text-muted-foreground">Friends + split costs</span>
                        </a>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/app/public?new=public">
                        <a className="flex flex-col items-start py-2" onClick={() => setIsSidebarOpen(false)}>
                          <span className="text-sm font-medium">Public event</span>
                          <span className="text-xs text-muted-foreground">Professional/public listing</span>
                        </a>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">Quick switch</p>
                  <Input
                    value={mobileQuickSwitchSearch}
                    onChange={(e) => setMobileQuickSwitchSearch(e.target.value)}
                    placeholder="Search events..."
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="px-3 pb-3 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-1 pr-1">
                  {mobileQuickSwitchEvents.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-1.5">No events found</p>
                  ) : (
                    mobileQuickSwitchEvents.map((event) => (
                      <Link key={`mobile-event-${event.id}`} href={`/app/e/${event.id}`}>
                        <a
                          onClick={() => setIsSidebarOpen(false)}
                          className="block rounded-md border border-transparent px-2 py-1.5 text-xs hover:border-border/60 hover:bg-muted/30"
                        >
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
            </aside>
          </div>
        )}

        <AppSidebar section={section} />
        <main className="min-w-0 flex-1">
          {section === "home" && <AppDashboardHome />}
          {section === "explore" && <ExplorePage />}
          {section === "private" && (shouldUseLegacyHomeForCreate ? <Home appRouteMode="private" /> : <PrivateHomePage user={user} />)}
          {section === "public" && (shouldUseLegacyHomeForCreate ? <Home appRouteMode="public" /> : <PublicHomePage />)}
          {section === "event" && <Home appRouteMode="event" routeEventId={routeEventId} />}
        </main>
      </div>
    </EventHeaderPreferencesProvider>
  );
}
