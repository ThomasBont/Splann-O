export type SidebarWidth = "compact" | "default" | "wide";
export type SmartSectionKind = "UPCOMING" | "RECENT" | "DRAFTS" | "UNSETTLED";
export type SidebarSectionType = "PIN_GROUPS" | "QUICK_SWITCH" | "SMART";

export type SidebarSectionConfig = {
  id: string;
  type: SidebarSectionType;
  title?: string;
  collapsed?: boolean;
  heightPx?: number;
  props?: {
    kind?: SmartSectionKind;
  };
};

export type SidebarLayout = {
  version: number;
  width: SidebarWidth;
  sections: SidebarSectionConfig[];
};

export type PinGroup = {
  id: string;
  name: string;
  collapsed?: boolean;
  eventIds: number[];
};

export const SIDEBAR_LAYOUT_VERSION = 1;

export function defaultSidebarLayout(): SidebarLayout {
  return {
    version: SIDEBAR_LAYOUT_VERSION,
    width: "default",
    sections: [
      { id: "pin-groups", type: "PIN_GROUPS", title: "Pin groups", collapsed: false, heightPx: 160 },
      { id: "quick-switch", type: "QUICK_SWITCH", title: "Quick switch", collapsed: false, heightPx: 280 },
      { id: "smart-recent", type: "SMART", title: "Recent", collapsed: false, heightPx: 180, props: { kind: "RECENT" } },
    ],
  };
}

export function defaultPinGroups(): PinGroup[] {
  return [
    {
      id: "default",
      name: "Pinned",
      collapsed: false,
      eventIds: [],
    },
  ];
}

export function sanitizeSidebarLayout(input: unknown): SidebarLayout {
  const fallback = defaultSidebarLayout();
  if (!input || typeof input !== "object") return fallback;
  const raw = input as Partial<SidebarLayout>;
  if (raw.version !== SIDEBAR_LAYOUT_VERSION) return fallback;
  const width: SidebarWidth = raw.width === "compact" || raw.width === "wide" ? raw.width : "default";
  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  const sanitizedSections = sections
    .map<SidebarSectionConfig | null>((section) => {
      if (!section || typeof section !== "object") return null;
      const s = section as SidebarSectionConfig;
      if (!s.id || typeof s.id !== "string") return null;
      if (!["PIN_GROUPS", "QUICK_SWITCH", "SMART"].includes(s.type)) return null;
      const collapsed = Boolean(s.collapsed);
      const heightPx = Number.isFinite(s.heightPx) ? Math.max(120, Math.min(520, Number(s.heightPx))) : undefined;
      const title = typeof s.title === "string" ? s.title : undefined;
      const props =
        s.type === "SMART"
          ? {
              kind:
                s.props?.kind === "UPCOMING" ||
                s.props?.kind === "DRAFTS" ||
                s.props?.kind === "UNSETTLED" ||
                s.props?.kind === "RECENT"
                  ? s.props.kind
                  : "RECENT",
            }
          : undefined;
      return { id: s.id, type: s.type, title, collapsed, heightPx, props };
    })
    .filter((section): section is SidebarSectionConfig => section !== null);

  if (!sanitizedSections.some((s) => s.type === "QUICK_SWITCH")) {
    sanitizedSections.push({ id: "quick-switch", type: "QUICK_SWITCH", title: "Quick switch", heightPx: 280 });
  }
  if (!sanitizedSections.some((s) => s.type === "PIN_GROUPS")) {
    sanitizedSections.unshift({ id: "pin-groups", type: "PIN_GROUPS", title: "Pin groups", heightPx: 160 });
  }

  return {
    version: SIDEBAR_LAYOUT_VERSION,
    width,
    sections: sanitizedSections,
  };
}

export function sanitizePinGroups(input: unknown): PinGroup[] {
  const fallback = defaultPinGroups();
  if (!Array.isArray(input)) return fallback;
  const groups = input
    .map<PinGroup | null>((group) => {
      if (!group || typeof group !== "object") return null;
      const g = group as PinGroup;
      if (!g.id || typeof g.id !== "string") return null;
      if (!g.name || typeof g.name !== "string") return null;
      const eventIds = Array.isArray(g.eventIds)
        ? g.eventIds.filter((id): id is number => Number.isInteger(id))
        : [];
      return {
        id: g.id,
        name: g.name,
        collapsed: Boolean(g.collapsed),
        eventIds: Array.from(new Set(eventIds)),
      };
    })
    .filter((group): group is PinGroup => group !== null);
  return groups.length ? groups : fallback;
}
