import type { LucideIcon } from "lucide-react";
import {
  Flame,
  Cake,
  UtensilsCrossed,
  Home,
  Gamepad2,
  Film,
  Waves,
  Music2,
  MoreHorizontal,
} from "lucide-react";
import type { EventTemplateTokens } from "./types";

export type PartyTypeKey =
  | "barbecue"
  | "birthday"
  | "dinner_party"
  | "house_party"
  | "game_night"
  | "movie_night"
  | "pool_party"
  | "after_party"
  | "other_party";

function t(
  bg: string,
  fg: string,
  card: string,
  cardFg: string,
  accent: string,
  accentFg: string
): EventTemplateTokens {
  return {
    background: bg,
    foreground: fg,
    card,
    cardForeground: cardFg,
    accent,
    accentForeground: accentFg,
  };
}

export interface RecommendedExpense {
  item: string;
  category: string;
  splitType?: "equal";
  notes?: string;
}

export interface PartyTemplate {
  key: PartyTypeKey;
  label: string;
  icon: LucideIcon;
  hero: {
    title: string;
    subtitle: string;
    emoji?: string;
  };
  tokens: {
    light: EventTemplateTokens;
    dark: EventTemplateTokens;
  };
  /** Optional subtle background decoration class (e.g. gradient, pattern). Must be subtle. */
  decorationClass?: string;
  /** Optional CSS background-image for a background layer. Applied at 5–12% opacity. E.g. linear-gradient(...) */
  backgroundStyle?: string;
  recommendedExpenses: RecommendedExpense[];
}

/** Subtle background gradients at low opacity. Use with wrapper background layer. */
const BG = {
  barbecue: "linear-gradient(135deg, rgba(249,115,22,1) 0%, transparent 45%, rgba(245,158,11,0.6) 100%)",
  birthday: "linear-gradient(135deg, rgba(236,72,153,1) 0%, transparent 50%, rgba(192,132,252,0.5) 100%)",
  dinner: "linear-gradient(135deg, rgba(251,191,36,1) 0%, transparent 50%, rgba(234,179,8,0.5) 100%)",
  house: "linear-gradient(135deg, rgba(139,92,246,1) 0%, transparent 50%, rgba(168,85,247,0.5) 100%)",
  game: "linear-gradient(135deg, rgba(16,185,129,1) 0%, transparent 50%, rgba(34,197,94,0.5) 100%)",
  movie: "linear-gradient(135deg, rgba(99,102,241,1) 0%, transparent 50%, rgba(59,130,246,0.5) 100%)",
  pool: "linear-gradient(135deg, rgba(6,182,212,1) 0%, transparent 50%, rgba(20,184,166,0.5) 100%)",
  after: "linear-gradient(135deg, rgba(217,70,239,1) 0%, transparent 50%, rgba(244,63,94,0.5) 100%)",
  other: "linear-gradient(135deg, rgba(100,116,139,0.8) 0%, transparent 50%, rgba(71,85,105,0.5) 100%)",
};

const BARBECUE: PartyTemplate = {
  key: "barbecue",
  label: "Barbecue",
  icon: Flame,
  hero: { title: "Barbecue", subtitle: "Grill, chill, and keep the split fair.", emoji: "🔥" },
  tokens: {
    light: t("0 0% 98%", "25 20% 15%", "0 0% 100%", "25 20% 15%", "25 75% 52%", "0 0% 100%"),
    dark: t("25 25% 12%", "25 10% 92%", "25 22% 16%", "25 10% 92%", "25 75% 55%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-orange-500/[0.03] via-transparent to-amber-500/[0.02]",
  backgroundStyle: BG.barbecue,
  recommendedExpenses: [
    { item: "Meat & groceries", category: "Meat" },
    { item: "Drinks", category: "Drinks" },
    { item: "Charcoal / gas", category: "Charcoal" },
    { item: "Disposable plates/cups", category: "Other" },
    { item: "Ice", category: "Other" },
  ],
};

const BIRTHDAY: PartyTemplate = {
  key: "birthday",
  label: "Birthday",
  icon: Cake,
  hero: { title: "Birthday", subtitle: "Celebrate big, share the costs smoothly.", emoji: "🎂" },
  tokens: {
    light: t("330 40% 98%", "330 20% 15%", "0 0% 100%", "330 20% 15%", "330 70% 60%", "0 0% 100%"),
    dark: t("330 25% 12%", "330 10% 92%", "330 22% 16%", "330 10% 92%", "330 70% 62%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-pink-500/[0.04] via-transparent to-fuchsia-500/[0.02]",
  backgroundStyle: BG.birthday,
  recommendedExpenses: [
    { item: "Cake", category: "Food" },
    { item: "Decorations", category: "Other" },
    { item: "Drinks", category: "Drinks" },
    { item: "Gift contribution", category: "Other" },
    { item: "Venue / table reservation", category: "Tickets" },
  ],
};

const DINNER_PARTY: PartyTemplate = {
  key: "dinner_party",
  label: "Dinner Party",
  icon: UtensilsCrossed,
  hero: { title: "Dinner Party", subtitle: "Good food, good company, fair splits.", emoji: "🍽️" },
  tokens: {
    light: t("30 35% 98%", "30 25% 12%", "0 0% 100%", "30 25% 12%", "30 55% 48%", "0 0% 100%"),
    dark: t("30 25% 11%", "30 10% 92%", "30 20% 15%", "30 10% 92%", "30 60% 52%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-amber-500/[0.03] via-transparent to-yellow-500/[0.02]",
  backgroundStyle: BG.dinner,
  recommendedExpenses: [
    { item: "Groceries", category: "Food" },
    { item: "Wine", category: "Drinks" },
    { item: "Dessert", category: "Food" },
    { item: "Taxi home", category: "Transport" },
  ],
};

const HOUSE_PARTY: PartyTemplate = {
  key: "house_party",
  label: "House Party",
  icon: Home,
  hero: { title: "House Party", subtitle: "Host at home, split the bill.", emoji: "🏠" },
  tokens: {
    light: t("260 40% 98%", "260 25% 12%", "0 0% 100%", "260 25% 12%", "260 65% 55%", "0 0% 100%"),
    dark: t("260 28% 11%", "260 10% 92%", "260 22% 15%", "260 10% 92%", "260 70% 58%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-violet-500/[0.03] via-transparent to-purple-500/[0.02]",
  backgroundStyle: BG.house,
  recommendedExpenses: [
    { item: "Drinks", category: "Drinks" },
    { item: "Snacks", category: "Food" },
    { item: "Cleaning supplies", category: "Other" },
    { item: "Music / speaker rental", category: "Other", notes: "Optional" },
  ],
};

const GAME_NIGHT: PartyTemplate = {
  key: "game_night",
  label: "Game Night",
  icon: Gamepad2,
  hero: { title: "Game Night", subtitle: "Play hard, split fair.", emoji: "🎮" },
  tokens: {
    light: t("140 35% 97%", "140 25% 12%", "0 0% 100%", "140 25% 12%", "140 55% 42%", "0 0% 100%"),
    dark: t("140 25% 11%", "140 10% 90%", "140 20% 15%", "140 10% 90%", "140 60% 48%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-green-500/[0.02]",
  backgroundStyle: BG.game,
  recommendedExpenses: [
    { item: "Snacks", category: "Food" },
    { item: "Drinks", category: "Drinks" },
    { item: "New game / DLC", category: "Other" },
    { item: "Pizza / delivery", category: "Food" },
  ],
};

const MOVIE_NIGHT: PartyTemplate = {
  key: "movie_night",
  label: "Movie Night",
  icon: Film,
  hero: { title: "Movie Night", subtitle: "Snacks, screens, and simple splits.", emoji: "🎬" },
  tokens: {
    light: t("250 35% 97%", "250 25% 12%", "0 0% 100%", "250 25% 12%", "250 65% 52%", "0 0% 100%"),
    dark: t("250 28% 10%", "250 10% 92%", "250 20% 14%", "250 10% 92%", "250 70% 55%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-blue-500/[0.02]",
  backgroundStyle: BG.movie,
  recommendedExpenses: [
    { item: "Streaming rental", category: "Tickets" },
    { item: "Snacks (popcorn)", category: "Food" },
    { item: "Drinks", category: "Drinks" },
    { item: "Takeaway", category: "Food" },
  ],
};

const POOL_PARTY: PartyTemplate = {
  key: "pool_party",
  label: "Pool Party",
  icon: Waves,
  hero: { title: "Pool Party", subtitle: "Splash, chill, split the bill.", emoji: "🏊" },
  tokens: {
    light: t("190 50% 98%", "190 25% 15%", "0 0% 100%", "190 25% 15%", "190 70% 45%", "0 0% 100%"),
    dark: t("190 35% 11%", "190 10% 92%", "190 25% 15%", "190 10% 92%", "190 75% 50%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-teal-500/[0.02]",
  backgroundStyle: BG.pool,
  recommendedExpenses: [
    { item: "Drinks", category: "Drinks" },
    { item: "Snacks", category: "Food" },
    { item: "Ice", category: "Other" },
    { item: "Floaties / pool items", category: "Other" },
  ],
};

const AFTER_PARTY: PartyTemplate = {
  key: "after_party",
  label: "Afterparty",
  icon: Music2,
  hero: { title: "Afterparty", subtitle: "Keep the vibe, split it right.", emoji: "🎵" },
  tokens: {
    light: t("320 40% 97%", "320 25% 12%", "0 0% 100%", "320 25% 12%", "320 65% 55%", "0 0% 100%"),
    dark: t("320 30% 11%", "320 10% 92%", "320 22% 15%", "320 10% 92%", "320 70% 58%", "0 0% 100%"),
  },
  decorationClass: "bg-gradient-to-br from-fuchsia-500/[0.03] via-transparent to-rose-500/[0.02]",
  backgroundStyle: BG.after,
  recommendedExpenses: [
    { item: "Taxi / Uber", category: "Transport" },
    { item: "Late-night food", category: "Food" },
    { item: "Drinks", category: "Drinks" },
    { item: "Club entry", category: "Tickets", notes: "Optional" },
  ],
};

const OTHER_PARTY: PartyTemplate = {
  key: "other_party",
  label: "Other",
  icon: MoreHorizontal,
  hero: { title: "Party", subtitle: "Split costs, stay friends.", emoji: "🎉" },
  backgroundStyle: BG.other,
  tokens: {
    light: t("240 15% 97%", "240 20% 15%", "0 0% 100%", "240 20% 15%", "240 60% 50%", "0 0% 100%"),
    dark: t("240 20% 12%", "240 10% 92%", "240 18% 16%", "240 10% 92%", "240 65% 52%", "0 0% 100%"),
  },
  recommendedExpenses: [
    { item: "Drinks", category: "Drinks" },
    { item: "Snacks", category: "Food" },
    { item: "Decorations", category: "Other" },
  ],
};

export const partyTemplates: Record<PartyTypeKey, PartyTemplate> = {
  barbecue: BARBECUE,
  birthday: BIRTHDAY,
  dinner_party: DINNER_PARTY,
  house_party: HOUSE_PARTY,
  game_night: GAME_NIGHT,
  movie_night: MOVIE_NIGHT,
  pool_party: POOL_PARTY,
  after_party: AFTER_PARTY,
  other_party: OTHER_PARTY,
};

export const PARTY_TYPE_KEYS: PartyTypeKey[] = [
  "barbecue",
  "birthday",
  "dinner_party",
  "house_party",
  "game_night",
  "movie_night",
  "pool_party",
  "after_party",
  "other_party",
];

const PARTY_KEYS_SET = new Set<string>(PARTY_TYPE_KEYS);

export function isPartyEventType(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  if (eventType === "default") return true;
  return PARTY_KEYS_SET.has(eventType);
}

/** Map eventType to party template key. "default" from DB maps to "other_party". */
function toPartyKey(eventType: string | null | undefined): PartyTypeKey {
  if (!eventType || eventType === "default") return "other_party";
  if (PARTY_KEYS_SET.has(eventType)) return eventType as PartyTypeKey;
  return "other_party";
}

export function getPartyTemplate(key: string | null | undefined): PartyTemplate {
  return partyTemplates[toPartyKey(key)] ?? OTHER_PARTY;
}
