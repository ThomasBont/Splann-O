import type { PrivateTemplateId } from "@/lib/private-event-templates";

export type PrivateEventTypeId =
  | "trip"
  | "dinner"
  | "game_night"
  | "party"
  | "weekend"
  | "meetup"
  | "generic";

export type PrivateEventVibeId =
  | "cozy"
  | "wild"
  | "minimal"
  | "classy"
  | "chill"
  | "relaxed"
  | "backpacking"
  | "adventure"
  | "workation"
  | "casual"
  | "fancy"
  | "romantic"
  | "potluck"
  | "competitive"
  | "snacks"
  | "tournament"
  | "networking"
  | "workshop"
  | "community"
  | "house_party"
  | "loud"
  | "clean";

export type PrivateEventTypeDef = {
  id: PrivateEventTypeId;
  label: string;
  description: string;
  emoji: string;
  area: "parties" | "trips";
  eventTypeValue: string;
  privateTemplateId: PrivateTemplateId;
  defaultVibe: PrivateEventVibeId;
};

export type PrivateEventVibeDef = {
  id: PrivateEventVibeId;
  label: string;
  description: string;
  emoji: string;
};

export const PRIVATE_EVENT_TYPES: PrivateEventTypeDef[] = [
  { id: "trip", label: "Trip", description: "Travel plans and shared costs", emoji: "✈️", area: "trips", eventTypeValue: "city_trip", privateTemplateId: "trip", defaultVibe: "relaxed" },
  { id: "dinner", label: "Dinner", description: "Food, drinks, and table vibes", emoji: "🍝", area: "parties", eventTypeValue: "dinner_party", privateTemplateId: "dinner", defaultVibe: "casual" },
  { id: "game_night", label: "Game night", description: "Play, snacks, and fun", emoji: "🎮", area: "parties", eventTypeValue: "game_night", privateTemplateId: "game_night", defaultVibe: "chill" },
  { id: "party", label: "Party", description: "Celebrate with your circle", emoji: "🎉", area: "parties", eventTypeValue: "house_party", privateTemplateId: "party", defaultVibe: "wild" },
  { id: "weekend", label: "Weekend", description: "Short getaways, easy planning", emoji: "🏕️", area: "trips", eventTypeValue: "weekend_getaway", privateTemplateId: "weekend", defaultVibe: "adventure" },
  { id: "meetup", label: "Meetup", description: "Recurring friend meetups", emoji: "👥", area: "parties", eventTypeValue: "other_party", privateTemplateId: "generic", defaultVibe: "community" },
  { id: "generic", label: "Generic", description: "Simple setup for anything", emoji: "🙂", area: "parties", eventTypeValue: "default", privateTemplateId: "generic", defaultVibe: "cozy" },
];

const VIBES: Record<PrivateEventVibeId, PrivateEventVibeDef> = {
  cozy: { id: "cozy", label: "Cozy", description: "Warm and intimate", emoji: "🫶" },
  wild: { id: "wild", label: "Wild", description: "High energy, big plans", emoji: "🔥" },
  minimal: { id: "minimal", label: "Minimal", description: "Simple and clean", emoji: "▫️" },
  classy: { id: "classy", label: "Classy", description: "Polished and elegant", emoji: "🥂" },
  chill: { id: "chill", label: "Chill", description: "Low pressure, easygoing", emoji: "😌" },
  relaxed: { id: "relaxed", label: "Relaxed", description: "Comfortable pace", emoji: "🌿" },
  backpacking: { id: "backpacking", label: "Backpacking", description: "Lean and flexible", emoji: "🎒" },
  adventure: { id: "adventure", label: "Adventure", description: "Active and outdoorsy", emoji: "🧭" },
  workation: { id: "workation", label: "Workation", description: "Work + downtime", emoji: "💻" },
  casual: { id: "casual", label: "Casual", description: "Everyday and friendly", emoji: "🍷" },
  fancy: { id: "fancy", label: "Fancy", description: "Elevated dinner style", emoji: "✨" },
  romantic: { id: "romantic", label: "Romantic", description: "Soft and intimate", emoji: "🌹" },
  potluck: { id: "potluck", label: "Potluck", description: "Everyone brings something", emoji: "🥘" },
  competitive: { id: "competitive", label: "Competitive", description: "Scoreboards on", emoji: "🏆" },
  snacks: { id: "snacks", label: "Snacks", description: "Food-first setup", emoji: "🍿" },
  tournament: { id: "tournament", label: "Tournament", description: "Bracket mode", emoji: "🎯" },
  networking: { id: "networking", label: "Networking", description: "Meet and connect", emoji: "🤝" },
  workshop: { id: "workshop", label: "Workshop", description: "Learn and share", emoji: "🧠" },
  community: { id: "community", label: "Community", description: "Open and social", emoji: "🌍" },
  house_party: { id: "house_party", label: "House party", description: "Home-hosted energy", emoji: "🏠" },
  loud: { id: "loud", label: "Loud", description: "Bold and playful", emoji: "📣" },
  clean: { id: "clean", label: "Clean", description: "Neutral and neat", emoji: "🧼" },
};

export const PRIVATE_EVENT_VIBES_BY_TYPE: Record<PrivateEventTypeId, PrivateEventVibeDef[]> = {
  party: [VIBES.wild, VIBES.classy, VIBES.cozy, VIBES.house_party],
  trip: [VIBES.relaxed, VIBES.backpacking, VIBES.adventure, VIBES.workation],
  dinner: [VIBES.casual, VIBES.fancy, VIBES.romantic, VIBES.potluck],
  game_night: [VIBES.competitive, VIBES.casual, VIBES.snacks, VIBES.tournament],
  meetup: [VIBES.networking, VIBES.workshop, VIBES.community, VIBES.chill],
  weekend: [VIBES.relaxed, VIBES.adventure, VIBES.chill, VIBES.cozy],
  generic: [VIBES.minimal, VIBES.cozy, VIBES.loud, VIBES.clean],
};

export const VIBE_THEME: Record<PrivateEventVibeId, { gradientClass: string; helperCopy: string }> = {
  cozy: { gradientClass: "bg-gradient-to-r from-rose-400/25 to-orange-300/20", helperCopy: "Warm, friendly, and easy to coordinate." },
  wild: { gradientClass: "bg-gradient-to-r from-fuchsia-500/25 to-rose-500/20", helperCopy: "Big energy with clear planning." },
  minimal: { gradientClass: "bg-gradient-to-r from-zinc-400/20 to-zinc-300/15", helperCopy: "Clean setup, no clutter." },
  classy: { gradientClass: "bg-gradient-to-r from-amber-400/25 to-stone-300/20", helperCopy: "Elegant tone with practical details." },
  chill: { gradientClass: "bg-gradient-to-r from-sky-400/25 to-cyan-300/20", helperCopy: "Low-pressure vibe, high clarity." },
  relaxed: { gradientClass: "bg-gradient-to-r from-emerald-400/25 to-teal-300/20", helperCopy: "Smooth pace for shared plans." },
  backpacking: { gradientClass: "bg-gradient-to-r from-lime-500/25 to-emerald-400/20", helperCopy: "Flexible and lightweight planning." },
  adventure: { gradientClass: "bg-gradient-to-r from-indigo-500/25 to-sky-400/20", helperCopy: "Active plans, grounded logistics." },
  workation: { gradientClass: "bg-gradient-to-r from-blue-500/25 to-violet-400/20", helperCopy: "Balanced between focus and fun." },
  casual: { gradientClass: "bg-gradient-to-r from-orange-400/25 to-amber-300/20", helperCopy: "Simple dinner vibe, easy split." },
  fancy: { gradientClass: "bg-gradient-to-r from-violet-500/25 to-fuchsia-400/20", helperCopy: "Polished details, no friction." },
  romantic: { gradientClass: "bg-gradient-to-r from-rose-500/25 to-pink-400/20", helperCopy: "Soft and intentional atmosphere." },
  potluck: { gradientClass: "bg-gradient-to-r from-yellow-500/20 to-orange-400/20", helperCopy: "Everyone contributes, everyone included." },
  competitive: { gradientClass: "bg-gradient-to-r from-red-500/25 to-orange-500/20", helperCopy: "Keep score and keep it fair." },
  snacks: { gradientClass: "bg-gradient-to-r from-amber-500/20 to-lime-400/20", helperCopy: "Snack-friendly setup for long sessions." },
  tournament: { gradientClass: "bg-gradient-to-r from-purple-500/25 to-indigo-500/20", helperCopy: "Structured rounds, clear outcomes." },
  networking: { gradientClass: "bg-gradient-to-r from-sky-500/25 to-blue-500/20", helperCopy: "Make intros easy and organized." },
  workshop: { gradientClass: "bg-gradient-to-r from-teal-500/25 to-cyan-500/20", helperCopy: "Focused collaboration, minimal friction." },
  community: { gradientClass: "bg-gradient-to-r from-green-500/25 to-emerald-500/20", helperCopy: "Open and welcoming group feeling." },
  house_party: { gradientClass: "bg-gradient-to-r from-pink-500/25 to-violet-500/20", helperCopy: "Home setup with party energy." },
  loud: { gradientClass: "bg-gradient-to-r from-rose-500/25 to-red-500/20", helperCopy: "Bold style, still in control." },
  clean: { gradientClass: "bg-gradient-to-r from-slate-400/20 to-zinc-400/15", helperCopy: "Clear and calm from start to finish." },
};

export function getPrivateEventTypeById(id: PrivateEventTypeId | null | undefined): PrivateEventTypeDef {
  return PRIVATE_EVENT_TYPES.find((type) => type.id === id) ?? PRIVATE_EVENT_TYPES.find((type) => type.id === "generic")!;
}

export function inferPrivateEventTypeFromEventType(eventType: string | null | undefined): PrivateEventTypeId {
  const value = (eventType ?? "").toLowerCase();
  if (value.includes("trip") || value.includes("vacation") || value.includes("backpacking") || value.includes("workation") || value.includes("camp")) return "trip";
  if (value.includes("dinner")) return "dinner";
  if (value.includes("game")) return "game_night";
  if (value.includes("party") || value.includes("birthday") || value.includes("barbecue")) return "party";
  if (value.includes("weekend")) return "weekend";
  return "generic";
}

export function getDefaultVibeForType(typeId: PrivateEventTypeId): PrivateEventVibeId {
  return getPrivateEventTypeById(typeId).defaultVibe;
}
