export type PlanTaxonomyMainType = "trip" | "party";

export type PlanTaxonomySubcategory =
  | "backpacking"
  | "city_trip"
  | "workation"
  | "roadtrip"
  | "ski_trip"
  | "beach_getaway"
  | "festival_trip"
  | "weekend_escape"
  | "barbecue"
  | "cinema"
  | "game_night"
  | "dinner"
  | "house_party"
  | "birthday"
  | "drinks_night"
  | "brunch";

export type ChatPatternVariant =
  | "travel"
  | "food"
  | "birthday"
  | "party"
  | "generic"
  | "beach"
  | "games"
  | "music"
  | "outdoor"
  | "work";

export type VisualTagId =
  | "outdoor"
  | "sunset"
  | "music"
  | "drinks"
  | "food"
  | "games"
  | "cozy"
  | "celebration"
  | "beach"
  | "culture"
  | "adventure"
  | "work"
  | "wellness"
  | "nightlife"
  | "nature"
  | "luxury"
  | "local_food"
  | "sightseeing"
  | "sports"
  | "campfire"
  | "romantic"
  | "family"
  | "late_night"
  | "creative";

export type VisualTagDef = {
  id: VisualTagId;
  label: string;
  emoji: string;
  variant: ChatPatternVariant;
};

export const VISUAL_TAG_DEFS: VisualTagDef[] = [
  { id: "outdoor", label: "Outdoor", emoji: "🌿", variant: "outdoor" },
  { id: "sunset", label: "Sunset", emoji: "🌅", variant: "beach" },
  { id: "music", label: "Music", emoji: "🎵", variant: "music" },
  { id: "drinks", label: "Drinks", emoji: "🍸", variant: "party" },
  { id: "food", label: "Food", emoji: "🍽️", variant: "food" },
  { id: "games", label: "Games", emoji: "🎲", variant: "games" },
  { id: "cozy", label: "Cozy", emoji: "🕯️", variant: "generic" },
  { id: "celebration", label: "Celebration", emoji: "🎉", variant: "birthday" },
  { id: "beach", label: "Beach", emoji: "🏖️", variant: "beach" },
  { id: "culture", label: "Culture", emoji: "🏛️", variant: "generic" },
  { id: "adventure", label: "Adventure", emoji: "🧭", variant: "travel" },
  { id: "work", label: "Work-friendly", emoji: "💼", variant: "work" },
  { id: "wellness", label: "Relaxed", emoji: "🧘", variant: "generic" },
  { id: "nightlife", label: "Nightlife", emoji: "🌙", variant: "party" },
  { id: "nature", label: "Nature", emoji: "🌲", variant: "outdoor" },
  { id: "luxury", label: "Luxury", emoji: "✨", variant: "generic" },
  { id: "local_food", label: "Local food", emoji: "🍜", variant: "food" },
  { id: "sightseeing", label: "Sightseeing", emoji: "📍", variant: "travel" },
  { id: "sports", label: "Sports", emoji: "🏄", variant: "outdoor" },
  { id: "campfire", label: "Campfire", emoji: "🔥", variant: "outdoor" },
  { id: "romantic", label: "Romantic", emoji: "🌹", variant: "birthday" },
  { id: "family", label: "Family", emoji: "👨‍👩‍👧", variant: "birthday" },
  { id: "late_night", label: "Late night", emoji: "🌃", variant: "party" },
  { id: "creative", label: "Creative", emoji: "🎨", variant: "music" },
];

const VISUAL_TAG_BY_ID = Object.fromEntries(VISUAL_TAG_DEFS.map((item) => [item.id, item])) as Record<VisualTagId, VisualTagDef>;

const VISUAL_TAGS_BY_MAIN_TYPE: Record<PlanTaxonomyMainType, VisualTagId[]> = {
  trip: [
    "adventure",
    "outdoor",
    "nature",
    "culture",
    "food",
    "local_food",
    "sightseeing",
    "cozy",
    "beach",
    "wellness",
    "sports",
    "luxury",
  ],
  party: [
    "music",
    "drinks",
    "food",
    "games",
    "cozy",
    "celebration",
    "outdoor",
    "nightlife",
    "late_night",
    "creative",
    "family",
    "romantic",
  ],
};

const VISUAL_TAGS_BY_SUBCATEGORY: Partial<Record<PlanTaxonomySubcategory, VisualTagId[]>> = {
  backpacking: ["adventure", "outdoor", "nature", "campfire", "cozy", "sports"],
  city_trip: ["culture", "sightseeing", "food", "local_food", "nightlife", "luxury"],
  workation: ["work", "cozy", "food", "wellness", "nature", "beach"],
  roadtrip: ["adventure", "outdoor", "music", "campfire", "nature", "late_night"],
  ski_trip: ["adventure", "outdoor", "sports", "cozy", "nature", "luxury"],
  beach_getaway: ["beach", "sunset", "wellness", "drinks", "food", "romantic"],
  festival_trip: ["music", "nightlife", "adventure", "creative", "late_night", "drinks"],
  weekend_escape: ["cozy", "food", "culture", "wellness", "romantic", "nature"],
  barbecue: ["outdoor", "food", "drinks", "campfire", "music", "family"],
  cinema: ["cozy", "food", "culture", "romantic", "late_night", "creative"],
  game_night: ["games", "drinks", "cozy", "food", "music", "creative"],
  dinner: ["food", "cozy", "celebration", "romantic", "local_food", "luxury"],
  house_party: ["music", "drinks", "nightlife", "late_night", "creative", "celebration"],
  birthday: ["celebration", "food", "music", "family", "drinks", "games"],
  drinks_night: ["drinks", "music", "nightlife", "late_night", "creative", "food"],
  brunch: ["food", "outdoor", "cozy", "sunset", "wellness", "family"],
};

export function normalizeVisualTag(value: unknown): VisualTagId | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  return key in VISUAL_TAG_BY_ID ? (key as VisualTagId) : null;
}

export function getVisualTagDef(tagId: VisualTagId): VisualTagDef {
  return VISUAL_TAG_BY_ID[tagId];
}

export function getAvailableVisualTags(
  mainType: PlanTaxonomyMainType | null,
  subcategory: PlanTaxonomySubcategory | null,
): VisualTagDef[] {
  if (!mainType) return [];
  const ordered = [
    ...(subcategory ? (VISUAL_TAGS_BY_SUBCATEGORY[subcategory] ?? []) : []),
    ...VISUAL_TAGS_BY_MAIN_TYPE[mainType],
  ];
  const seen = new Set<VisualTagId>();
  const unique: VisualTagDef[] = [];
  for (const tagId of ordered) {
    if (seen.has(tagId)) continue;
    seen.add(tagId);
    unique.push(VISUAL_TAG_BY_ID[tagId]);
  }
  return unique;
}

export function extractVisualTagsFromTemplateData(templateData: unknown): VisualTagId[] {
  if (!templateData || typeof templateData !== "object") return [];
  const raw = (templateData as Record<string, unknown>).visualTags;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<VisualTagId>();
  const result: VisualTagId[] = [];
  for (const candidate of raw) {
    const normalized = normalizeVisualTag(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function getPatternVariantsForVisualTags(tags: VisualTagId[]): ChatPatternVariant[] {
  const variants: ChatPatternVariant[] = [];
  for (const tag of tags) {
    const variant = VISUAL_TAG_BY_ID[tag]?.variant;
    if (!variant || variants.includes(variant)) continue;
    variants.push(variant);
  }
  return variants;
}
