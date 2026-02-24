/**
 * Centralized event theme definitions.
 * Single source of truth for event type UI: colors, gradients, icons, labels.
 * Use getEventTheme(eventKind, eventType) to resolve a ThemeToken.
 */

import { cn } from "@/lib/utils";

export type EventCategory = "party" | "trip";

export type TripType =
  | "city_trip"
  | "road_trip"
  | "beach_trip"
  | "ski_trip"
  | "festival_trip"
  | "hiking_trip"
  | "camping"
  | "weekend_getaway"
  | "business_trip"
  | "other_trip";

export type PartyType =
  | "barbecue"
  | "birthday"
  | "dinner_party"
  | "house_party"
  | "game_night"
  | "pool_party"
  | "after_party"
  | "movie_night"
  | "other_party";

export interface ThemeToken {
  id: string;
  /** i18n key for eventTypes (camelCase, e.g. barbecue, dinnerParty) */
  labelKey: string;
  /** Fallback display label (English, used when i18n not available e.g. gallery) */
  label: string;
  /** Emoji for icon badge */
  icon: string;
  accent: {
    bg: string;
    text: string;
    border: string;
  };
  header: {
    /** Tailwind class for thin header strip gradient */
    stripGradientClass: string;
    /** Optional subtle background for header container */
    subtleBgClass?: string;
  };
  /** Optional Tailwind class for chip hover (e.g. hover:border-orange-500/30) */
  chipHoverClass?: string;
  /** Fallback copy (used when i18n not available) */
  copy: {
    tagline: string;
    emptyExpensesTitle: string;
    emptyExpensesBody: string;
    ctaAddFirstExpense: string;
  };
  /** Optional key for expense templates (future use) */
  recommendedExpensesPresetKey?: string;
}

/** Helper to build theme-derived class names. Keeps surfaces neutral; accent used subtly. */
export function cnTheme(theme: ThemeToken, slot: "badge" | "strip" | "chipHover"): string {
  switch (slot) {
    case "badge":
      return cn(theme.accent.bg, theme.accent.text);
    case "strip":
      return theme.header.stripGradientClass;
    case "chipHover":
      return theme.chipHoverClass ?? "hover:bg-muted/50 hover:border-primary/30";
    default:
      return "";
  }
}

/** Returns accent + subtle background for CTA, badge, indicator. Use for theme-accented elements only. */
export function getThemeAccentStyles(theme: ThemeToken) {
  return {
    accent: theme.accent.text,
    accentBg: theme.accent.bg,
    accentBorder: theme.accent.border,
    /** Badge/chip background at ~10–15% opacity */
    subtleBg: theme.accent.bg,
  };
}

/** Map eventType (snake_case) to i18n labelKey (camelCase). Centralized for dropdowns, discover, etc. */
export const EVENT_TYPE_TO_LABEL_KEY: Record<string, string> = {
  default: "otherParty",
  barbecue: "barbecue",
  birthday: "birthday",
  dinner_party: "dinnerParty",
  house_party: "houseParty",
  game_night: "gameNight",
  movie_night: "movieNight",
  pool_party: "poolParty",
  after_party: "afterParty",
  other_party: "otherParty",
  city_trip: "cityTrip",
  road_trip: "roadTrip",
  beach_trip: "beachTrip",
  ski_trip: "skiTrip",
  festival_trip: "festivalTrip",
  hiking_trip: "hikingTrip",
  camping: "camping",
  weekend_getaway: "weekendGetaway",
  business_trip: "businessTrip",
  other_trip: "otherTrip",
  vacation: "vacation",
  backpacking: "backpacking",
  bachelor_trip: "bachelorTrip",
  workation: "workation",
  cinema: "cinema",
  theme_park: "themePark",
  day_out: "dayOut",
};

// ─── Trip themes (Tailwind classes, dark-safe) ────────────────────────────────

const tripThemes = {
  city_trip: {
    id: "city_trip",
    labelKey: "cityTrip",
    label: "City Trip",
    icon: "🗺️",
    accent: {
      bg: "bg-blue-500/15 dark:bg-blue-500/20",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-blue-500/70 via-indigo-500/60 to-blue-600/70 dark:from-blue-500/60 dark:via-indigo-500/50 dark:to-blue-600/60",
    },
    chipHoverClass: "hover:bg-blue-500/10 hover:border-blue-500/30",
    copy: {
      tagline: "Maps, metros, and memories.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add accommodation, transport, and activities to split costs.",
      ctaAddFirstExpense: "Add transport or accommodation",
    },
  },
  road_trip: {
    id: "road_trip",
    labelKey: "roadTrip",
    label: "Road Trip",
    icon: "🚗",
    accent: {
      bg: "bg-orange-500/15 dark:bg-orange-500/20",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-orange-500/70 via-amber-500/60 to-orange-600/70 dark:from-orange-500/60 dark:via-amber-500/50 dark:to-orange-600/60",
    },
    chipHoverClass: "hover:bg-orange-500/10 hover:border-orange-500/30",
    copy: {
      tagline: "Miles, memories, fair shares.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Track fuel, tolls, and snacks to split the trip.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  beach_trip: {
    id: "beach_trip",
    labelKey: "beachTrip",
    label: "Beach Trip",
    icon: "🏖️",
    accent: {
      bg: "bg-cyan-500/15 dark:bg-cyan-500/20",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-cyan-500/70 via-teal-500/60 to-cyan-600/70 dark:from-cyan-500/60 dark:via-teal-500/50 dark:to-cyan-600/60",
    },
    chipHoverClass: "hover:bg-cyan-500/10 hover:border-cyan-500/30",
    copy: {
      tagline: "Sun, sand, and smooth splits.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add accommodation, food, and beach activities.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  ski_trip: {
    id: "ski_trip",
    labelKey: "skiTrip",
    label: "Ski Trip",
    icon: "⛷️",
    accent: {
      bg: "bg-sky-500/15 dark:bg-sky-500/20",
      text: "text-sky-600 dark:text-sky-400",
      border: "border-sky-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-sky-500/70 via-blue-400/60 to-sky-600/70 dark:from-sky-500/60 dark:via-blue-400/50 dark:to-sky-600/60",
    },
    chipHoverClass: "hover:bg-sky-500/10 hover:border-sky-500/30",
    copy: {
      tagline: "Fresh powder, fair splits.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add ski passes, equipment, and après-ski costs.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  festival_trip: {
    id: "festival_trip",
    labelKey: "festivalTrip",
    label: "Festival Trip",
    icon: "🎪",
    accent: {
      bg: "bg-purple-500/15 dark:bg-purple-500/20",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-purple-500/70 via-fuchsia-500/60 to-purple-600/70 dark:from-purple-500/60 dark:via-fuchsia-500/50 dark:to-purple-600/60",
    },
    chipHoverClass: "hover:bg-purple-500/10 hover:border-purple-500/30",
    copy: {
      tagline: "Split the vibe, keep the peace.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add tickets, accommodation, and drinks to split the festival.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  hiking_trip: {
    id: "hiking_trip",
    labelKey: "hikingTrip",
    label: "Hiking Trip",
    icon: "🥾",
    accent: {
      bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-emerald-500/70 via-green-500/60 to-emerald-600/70 dark:from-emerald-500/60 dark:via-green-500/50 dark:to-emerald-600/60",
    },
    chipHoverClass: "hover:bg-emerald-500/10 hover:border-emerald-500/30",
    copy: {
      tagline: "Trail, summit, fair splits.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add gear, transport, and trail fees.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  camping: {
    id: "camping",
    labelKey: "camping",
    label: "Camping",
    icon: "⛺",
    accent: {
      bg: "bg-lime-500/15 dark:bg-lime-500/20",
      text: "text-lime-600 dark:text-lime-400",
      border: "border-lime-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-lime-500/70 via-green-600/60 to-lime-600/70 dark:from-lime-500/60 dark:via-green-600/50 dark:to-lime-600/60",
    },
    chipHoverClass: "hover:bg-lime-500/10 hover:border-lime-500/30",
    copy: {
      tagline: "Under the stars, fair shares.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add gear, food, and campsite fees.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  weekend_getaway: {
    id: "weekend_getaway",
    labelKey: "weekendGetaway",
    label: "Weekend Getaway",
    icon: "🌅",
    accent: {
      bg: "bg-amber-500/15 dark:bg-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-amber-500/70 via-orange-400/60 to-amber-600/70 dark:from-amber-500/60 dark:via-orange-400/50 dark:to-amber-600/60",
    },
    chipHoverClass: "hover:bg-amber-500/10 hover:border-amber-500/30",
    copy: {
      tagline: "Quick escape, easy split.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add accommodation and activities for the weekend.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  business_trip: {
    id: "business_trip",
    labelKey: "businessTrip",
    label: "Business Trip",
    icon: "💼",
    accent: {
      bg: "bg-slate-500/15 dark:bg-slate-500/20",
      text: "text-slate-600 dark:text-slate-400",
      border: "border-slate-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-slate-500/70 via-slate-600/60 to-slate-500/70 dark:from-slate-500/60 dark:via-slate-400/50 dark:to-slate-500/60",
    },
    chipHoverClass: "hover:bg-slate-500/10 hover:border-slate-500/30",
    copy: {
      tagline: "Professional splits made simple.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add flights, accommodation, and meals.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  other_trip: {
    id: "other_trip",
    labelKey: "otherTrip",
    label: "Trip",
    icon: "✈️",
    accent: {
      bg: "bg-primary/15 dark:bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-primary/70 via-primary/60 to-primary/70 dark:from-primary/60 dark:via-primary/50 dark:to-primary/60",
    },
    chipHoverClass: "hover:bg-primary/10 hover:border-primary/30",
    copy: {
      tagline: "Split costs, stay friends.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add your first expense to get started.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
} as const satisfies Record<TripType, ThemeToken>;

// ─── Party themes ─────────────────────────────────────────────────────────────

const partyThemes = {
  barbecue: {
    id: "barbecue",
    labelKey: "barbecue",
    label: "Barbecue",
    icon: "🔥",
    accent: {
      bg: "bg-orange-500/15 dark:bg-orange-500/20",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-orange-500/70 via-amber-500/60 to-orange-600/70 dark:from-orange-500/60 dark:via-amber-500/50 dark:to-orange-600/60",
    },
    chipHoverClass: "hover:bg-orange-500/10 hover:border-orange-500/30",
    copy: {
      tagline: "Grill, chill, and keep the split fair.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add meat, drinks, and charcoal to split the barbecue.",
      ctaAddFirstExpense: "Add the first grill cost",
    },
  },
  birthday: {
    id: "birthday",
    labelKey: "birthday",
    label: "Birthday",
    icon: "🎂",
    accent: {
      bg: "bg-pink-500/15 dark:bg-pink-500/20",
      text: "text-pink-600 dark:text-pink-400",
      border: "border-pink-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-pink-500/70 via-rose-500/60 to-pink-600/70 dark:from-pink-500/60 dark:via-rose-500/50 dark:to-pink-600/60",
    },
    chipHoverClass: "hover:bg-pink-500/10 hover:border-pink-500/30",
    copy: {
      tagline: "Celebrate big, share the costs smoothly.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add cake, decorations, and drinks for the party.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  dinner_party: {
    id: "dinner_party",
    labelKey: "dinnerParty",
    label: "Dinner Party",
    icon: "🍽️",
    accent: {
      bg: "bg-amber-500/15 dark:bg-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-amber-500/70 via-yellow-500/60 to-amber-600/70 dark:from-amber-500/60 dark:via-yellow-500/50 dark:to-amber-600/60",
    },
    chipHoverClass: "hover:bg-amber-500/10 hover:border-amber-500/30",
    copy: {
      tagline: "Good food, good company, fair splits.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add groceries, wine, and dessert.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  house_party: {
    id: "house_party",
    labelKey: "houseParty",
    label: "House Party",
    icon: "🏠",
    accent: {
      bg: "bg-violet-500/15 dark:bg-violet-500/20",
      text: "text-violet-600 dark:text-violet-400",
      border: "border-violet-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-violet-500/70 via-purple-500/60 to-violet-600/70 dark:from-violet-500/60 dark:via-purple-500/50 dark:to-violet-600/60",
    },
    chipHoverClass: "hover:bg-violet-500/10 hover:border-violet-500/30",
    copy: {
      tagline: "Host at home, split the bill.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add drinks, snacks, and cleaning supplies.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  game_night: {
    id: "game_night",
    labelKey: "gameNight",
    label: "Game Night",
    icon: "🎮",
    accent: {
      bg: "bg-green-500/15 dark:bg-green-500/20",
      text: "text-green-600 dark:text-green-400",
      border: "border-green-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-green-500/70 via-emerald-500/60 to-green-600/70 dark:from-green-500/60 dark:via-emerald-500/50 dark:to-green-600/60",
    },
    chipHoverClass: "hover:bg-green-500/10 hover:border-green-500/30",
    copy: {
      tagline: "Play hard, split fair.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add snacks, drinks, and new games.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  pool_party: {
    id: "pool_party",
    labelKey: "poolParty",
    label: "Pool Party",
    icon: "🏊",
    accent: {
      bg: "bg-cyan-500/15 dark:bg-cyan-500/20",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-cyan-500/70 via-teal-500/60 to-cyan-600/70 dark:from-cyan-500/60 dark:via-teal-500/50 dark:to-cyan-600/60",
    },
    chipHoverClass: "hover:bg-cyan-500/10 hover:border-cyan-500/30",
    copy: {
      tagline: "Splash, chill, split the bill.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add drinks, snacks, and pool supplies.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  after_party: {
    id: "after_party",
    labelKey: "afterParty",
    label: "Afterparty",
    icon: "🎵",
    accent: {
      bg: "bg-fuchsia-500/15 dark:bg-fuchsia-500/20",
      text: "text-fuchsia-600 dark:text-fuchsia-400",
      border: "border-fuchsia-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-fuchsia-500/70 via-pink-500/60 to-fuchsia-600/70 dark:from-fuchsia-500/60 dark:via-pink-500/50 dark:to-fuchsia-600/60",
    },
    chipHoverClass: "hover:bg-fuchsia-500/10 hover:border-fuchsia-500/30",
    copy: {
      tagline: "Keep the vibe, split it right.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add taxi, late-night food, and drinks.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
  movie_night: {
    id: "movie_night",
    labelKey: "movieNight",
    label: "Movie Night",
    icon: "🎬",
    accent: {
      bg: "bg-indigo-500/15 dark:bg-indigo-500/20",
      text: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-500/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-indigo-500/70 via-blue-500/60 to-indigo-600/70 dark:from-indigo-500/60 dark:via-blue-500/50 dark:to-indigo-600/60",
    },
    chipHoverClass: "hover:bg-indigo-500/10 hover:border-indigo-500/30",
    copy: {
      tagline: "Snacks, screens, and simple splits.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add streaming rental, snacks, and drinks.",
      ctaAddFirstExpense: "Add snacks or streaming",
    },
  },
  other_party: {
    id: "other_party",
    labelKey: "otherParty",
    label: "Party",
    chipHoverClass: "hover:bg-primary/10 hover:border-primary/30",
    icon: "🎉",
    accent: {
      bg: "bg-primary/15 dark:bg-primary/20",
      text: "text-primary",
      border: "border-primary/30",
    },
    header: {
      stripGradientClass: "bg-gradient-to-r from-primary/70 via-primary/60 to-primary/70 dark:from-primary/60 dark:via-primary/50 dark:to-primary/60",
    },
    copy: {
      tagline: "Split costs, stay friends.",
      emptyExpensesTitle: "No expenses yet",
      emptyExpensesBody: "Add drinks, snacks, and decorations.",
      ctaAddFirstExpense: "Add first expense",
    },
  },
} as const satisfies Record<PartyType, ThemeToken>;

/** All trip themes keyed by TripType. */
export const TRIP_THEMES: Record<TripType, ThemeToken> = tripThemes;

/** All party themes keyed by PartyType. */
export const PARTY_THEMES: Record<PartyType, ThemeToken> = partyThemes;

export const TRIP_THEME_KEYS: readonly TripType[] = [
  "city_trip",
  "road_trip",
  "beach_trip",
  "ski_trip",
  "festival_trip",
  "hiking_trip",
  "camping",
  "weekend_getaway",
  "business_trip",
  "other_trip",
];

export const PARTY_THEME_KEYS: readonly PartyType[] = [
  "barbecue",
  "birthday",
  "dinner_party",
  "house_party",
  "game_night",
  "pool_party",
  "after_party",
  "movie_night",
  "other_party",
];
