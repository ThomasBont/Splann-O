import type { Barbecue } from "@shared/schema";
import type { ExpenseTemplateItem } from "@/eventTemplates/expenseTemplates";

export type PrivateTemplateId =
  | "trip"
  | "dinner"
  | "game_night"
  | "party"
  | "weekend"
  | "generic";

export type PrivateTemplateDef = {
  id: PrivateTemplateId;
  label: string;
  description: string;
  emoji: string;
  defaultQuickAdds: ExpenseTemplateItem[];
  emptyStates: {
    expenses: string;
    splitCheck: string;
    notes: string;
  };
  bannerStyle: "photo" | "gradient" | "emoji";
  bannerClassName: string;
};

const TEMPLATES: Record<PrivateTemplateId, PrivateTemplateDef> = {
  trip: {
    id: "trip",
    label: "Trip",
    description: "Travel plans and shared costs.",
    emoji: "✈️",
    bannerStyle: "gradient",
    bannerClassName: "bg-gradient-to-r from-sky-500/20 to-cyan-500/10",
    defaultQuickAdds: [
      { label: "Transport", category: "Transport", optInDefault: false, icon: "🛫" },
      { label: "Accommodation", category: "Accommodation", optInDefault: false, icon: "🏨" },
      { label: "Food", category: "Food", optInDefault: false, icon: "🍜" },
      { label: "Activities", category: "Tickets", optInDefault: true, icon: "🎟️" },
      { label: "Fuel / Tolls", category: "Transport", optInDefault: false, icon: "⛽" },
    ],
    emptyStates: {
      expenses: "No memories yet. Add the first expense when you’re ready.",
      splitCheck: "Once expenses roll in, Splanno will suggest a fair split.",
      notes: "Drop links, ideas, and inside jokes here.",
    },
  },
  dinner: {
    id: "dinner",
    label: "Dinner",
    description: "Food, drinks, and table vibes.",
    emoji: "🍝",
    bannerStyle: "gradient",
    bannerClassName: "bg-gradient-to-r from-orange-500/20 to-amber-500/10",
    defaultQuickAdds: [
      { label: "Groceries", category: "Food", optInDefault: false, icon: "🛒" },
      { label: "Wine", category: "Drinks", optInDefault: true, icon: "🍷" },
      { label: "Dessert", category: "Food", optInDefault: false, icon: "🍰" },
      { label: "Tip", category: "Other", optInDefault: false, icon: "💶" },
    ],
    emptyStates: {
      expenses: "No expenses yet. Add your first dish, drink, or shared cost.",
      splitCheck: "Split Check appears once dinner costs are in.",
      notes: "Add recipes, shopping lists, or table plans.",
    },
  },
  game_night: {
    id: "game_night",
    label: "Game Night",
    description: "Snacks, drinks, and rounds.",
    emoji: "🎮",
    bannerStyle: "gradient",
    bannerClassName: "bg-gradient-to-r from-violet-500/20 to-indigo-500/10",
    defaultQuickAdds: [
      { label: "Snacks", category: "Food", optInDefault: false, icon: "🍿" },
      { label: "Drinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { label: "Rental / Streaming", category: "Tickets", optInDefault: false, icon: "📺" },
      { label: "Pizza", category: "Food", optInDefault: false, icon: "🍕" },
    ],
    emptyStates: {
      expenses: "Game night starts here. Add the first shared cost.",
      splitCheck: "We’ll line up the split once people add expenses.",
      notes: "Keep game links, scores, and fun ideas here.",
    },
  },
  party: {
    id: "party",
    label: "Party",
    description: "Big plans, simple split.",
    emoji: "🎉",
    bannerStyle: "gradient",
    bannerClassName: "bg-gradient-to-r from-pink-500/20 to-rose-500/10",
    defaultQuickAdds: [
      { label: "Drinks", category: "Drinks", optInDefault: true, icon: "🍾" },
      { label: "Snacks", category: "Food", optInDefault: false, icon: "🍟" },
      { label: "Taxi", category: "Transport", optInDefault: true, icon: "🚕" },
      { label: "Decor", category: "Other", optInDefault: false, icon: "🎈" },
    ],
    emptyStates: {
      expenses: "No party costs yet. Add the first one to get started.",
      splitCheck: "Split Check will appear once party expenses are added.",
      notes: "Use notes for playlists, guest ideas, and reminders.",
    },
  },
  weekend: {
    id: "weekend",
    label: "Weekend",
    description: "A short getaway, neatly organized.",
    emoji: "🏕️",
    bannerStyle: "gradient",
    bannerClassName: "bg-gradient-to-r from-emerald-500/20 to-teal-500/10",
    defaultQuickAdds: [
      { label: "Accommodation", category: "Accommodation", optInDefault: false, icon: "🏡" },
      { label: "Groceries", category: "Food", optInDefault: false, icon: "🛒" },
      { label: "Transport", category: "Transport", optInDefault: false, icon: "🚗" },
      { label: "Activities", category: "Tickets", optInDefault: true, icon: "🎯" },
    ],
    emptyStates: {
      expenses: "Nothing logged yet. Add a weekend cost when you’re ready.",
      splitCheck: "We’ll calculate a fair split once expenses are in.",
      notes: "Keep plans, checklists, and links in one place.",
    },
  },
  generic: {
    id: "generic",
    label: "Generic",
    description: "Simple setup for any private event.",
    emoji: "🙂",
    bannerStyle: "emoji",
    bannerClassName: "bg-gradient-to-r from-neutral-500/20 to-neutral-500/10",
    defaultQuickAdds: [
      { label: "Food", category: "Food", optInDefault: false, icon: "🍽️" },
      { label: "Drinks", category: "Drinks", optInDefault: true, icon: "🥤" },
      { label: "Transport", category: "Transport", optInDefault: true, icon: "🚗" },
      { label: "Other", category: "Other", optInDefault: false, icon: "📦" },
    ],
    emptyStates: {
      expenses: "No expenses yet. Add the first one when you’re ready.",
      splitCheck: "Split Check will suggest balances once expenses are added.",
      notes: "Use notes to keep context close to the event.",
    },
  },
};

export const PRIVATE_TEMPLATE_ORDER: PrivateTemplateId[] = [
  "trip",
  "dinner",
  "game_night",
  "party",
  "weekend",
  "generic",
];

function normalizeTemplateId(value: unknown): PrivateTemplateId | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase() as PrivateTemplateId;
  return TEMPLATES[key] ? key : null;
}

export function getPrivateTemplateById(id: PrivateTemplateId | null | undefined): PrivateTemplateDef {
  if (id && TEMPLATES[id]) return TEMPLATES[id];
  return TEMPLATES.generic;
}

export function inferPrivateTemplateIdFromEvent(event: Partial<Barbecue> | null | undefined): PrivateTemplateId {
  const templateData =
    event?.templateData && typeof event.templateData === "object"
      ? (event.templateData as Record<string, unknown>)
      : null;
  const stored = normalizeTemplateId(templateData?.privateTemplateId);
  if (stored) return stored;

  const eventType = String(event?.eventType ?? "").toLowerCase();
  if (eventType.includes("trip") || eventType.includes("vacation") || eventType.includes("camp")) return "trip";
  if (eventType.includes("dinner")) return "dinner";
  if (eventType.includes("game") || eventType.includes("movie")) return "game_night";
  if (eventType.includes("party") || eventType.includes("birthday") || eventType.includes("barbecue")) return "party";
  if (eventType.includes("weekend")) return "weekend";
  return "generic";
}

export function getPrivateTemplateForEvent(event: Partial<Barbecue> | null | undefined): PrivateTemplateDef {
  return getPrivateTemplateById(inferPrivateTemplateIdFromEvent(event));
}

