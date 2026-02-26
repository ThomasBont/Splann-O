import type { CSSProperties } from "react";
import {
  PartyPopper,
  Handshake,
  Users,
  Wrench,
  Presentation,
  GraduationCap,
  Trophy,
  Shapes,
  type LucideIcon,
} from "lucide-react";

export type EventThemeCategory =
  | "party"
  | "networking"
  | "meetup"
  | "workshop"
  | "conference"
  | "training"
  | "sports"
  | "other";

export type EventTone = "social" | "neutral" | "professional";

export type EventThemeTokens = {
  category: EventThemeCategory;
  tone: EventTone;
  icon: LucideIcon;
  label: string;
  vars: {
    "--event-accent": string;
    "--event-tint": string;
    "--event-badge": string;
  };
  classes: {
    surface: string;
    badge: string;
    icon: string;
    strip: string;
  };
};

type ThemeTemplate = Omit<EventThemeTokens, "category" | "vars"> & {
  vars: { accentRef: string; tintRef: string; badgeRef: string };
};

const byCategory: Record<EventThemeCategory, ThemeTemplate> = {
  party: {
    tone: "social",
    icon: PartyPopper,
    label: "Party",
    vars: { accentRef: "--event-accent-social", tintRef: "--event-tint-social", badgeRef: "--event-badge-social" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.18)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.26),transparent_55%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.45)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.7)]",
    },
  },
  networking: {
    tone: "professional",
    icon: Handshake,
    label: "Networking",
    vars: { accentRef: "--event-accent-professional", tintRef: "--event-tint-professional", badgeRef: "--event-badge-professional" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.16)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.22),transparent_55%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.42)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.65)]",
    },
  },
  meetup: {
    tone: "neutral",
    icon: Users,
    label: "Meetup",
    vars: { accentRef: "--event-accent-meetup", tintRef: "--event-tint-neutral", badgeRef: "--event-badge-meetup" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.16)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.2),transparent_58%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.4)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.6)]",
    },
  },
  workshop: {
    tone: "neutral",
    icon: Wrench,
    label: "Workshop",
    vars: { accentRef: "--event-accent-neutral", tintRef: "--event-tint-neutral", badgeRef: "--event-badge-neutral" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.15)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.2),transparent_58%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.4)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.6)]",
    },
  },
  conference: {
    tone: "professional",
    icon: Presentation,
    label: "Conference",
    vars: { accentRef: "--event-accent-professional", tintRef: "--event-tint-professional", badgeRef: "--event-badge-professional" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.17)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.22),transparent_55%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.42)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.65)]",
    },
  },
  training: {
    tone: "neutral",
    icon: GraduationCap,
    label: "Training",
    vars: { accentRef: "--event-accent-neutral", tintRef: "--event-tint-neutral", badgeRef: "--event-badge-neutral" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.15)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.2),transparent_58%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.4)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.58)]",
    },
  },
  sports: {
    tone: "social",
    icon: Trophy,
    label: "Sports",
    vars: { accentRef: "--event-accent-sports", tintRef: "--event-tint-social", badgeRef: "--event-badge-sports" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.18)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.24),transparent_58%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.22)] bg-[hsl(var(--event-tint)/0.42)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.62)]",
    },
  },
  other: {
    tone: "neutral",
    icon: Shapes,
    label: "Other",
    vars: { accentRef: "--event-accent-neutral", tintRef: "--event-tint-neutral", badgeRef: "--event-badge-neutral" },
    classes: {
      surface: "border-[color:hsl(var(--event-badge)/0.14)] bg-[linear-gradient(to_bottom_right,hsl(var(--event-tint)/0.18),transparent_58%)]",
      badge: "border-[color:hsl(var(--event-badge)/0.2)] bg-[hsl(var(--event-tint)/0.38)] text-[hsl(var(--event-accent))]",
      icon: "text-[hsl(var(--event-accent))]",
      strip: "bg-[hsl(var(--event-accent)/0.55)]",
    },
  },
};

export function normalizeEventThemeCategory(category: string | null | undefined): EventThemeCategory {
  const c = (category ?? "").trim().toLowerCase();
  if (c in byCategory) return c as EventThemeCategory;
  return "other";
}

export function getEventTheme(category: string | null | undefined): EventThemeTokens {
  const normalized = normalizeEventThemeCategory(category);
  const t = byCategory[normalized];
  return {
    category: normalized,
    tone: t.tone,
    icon: t.icon,
    label: t.label,
    vars: {
      "--event-accent": `var(${t.vars.accentRef})`,
      "--event-tint": `var(${t.vars.tintRef})`,
      "--event-badge": `var(${t.vars.badgeRef})`,
    },
    classes: t.classes,
  };
}

export function getEventThemeStyle(category: string | null | undefined): CSSProperties {
  return getEventTheme(category).vars as unknown as CSSProperties;
}

export function getEventCategoryFromData(input: {
  eventType?: string | null;
  templateData?: unknown;
  visibilityOrigin?: string | null;
}): EventThemeCategory {
  const rawTemplate = (input.templateData && typeof input.templateData === "object") ? input.templateData as Record<string, unknown> : null;
  const publicCategory = typeof rawTemplate?.publicCategory === "string" ? rawTemplate.publicCategory : null;
  if (publicCategory) return normalizeEventThemeCategory(publicCategory);

  const type = (input.eventType ?? "").toLowerCase();
  if (type.includes("party") || type === "barbecue" || type === "birthday" || type === "game_night" || type === "movie_night" || type === "pool_party" || type === "after_party") return "party";
  if (type === "business_trip") return input.visibilityOrigin === "public" ? "networking" : "conference";
  if (type === "festival_trip" || type === "day_out" || type === "theme_park") return "meetup";
  if (type === "hiking_trip" || type === "ski_trip") return "sports";
  if (type === "road_trip" || type === "city_trip" || type === "beach_trip" || type === "weekend_getaway" || type === "camping") return "meetup";
  return "other";
}
