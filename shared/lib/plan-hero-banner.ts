import type { Barbecue } from "../schema";

export type HeroBannerMode = "preset" | "generated" | "uploaded";

export type EventBannerPresetId =
  | "editorial-escape"
  | "backpacking-editorial"
  | "metro-postcard"
  | "birthday-confetti"
  | "sunset-drive"
  | "coastal-breeze"
  | "alpine-air"
  | "barbecue-embers"
  | "ember-smoke"
  | "candle-dinner"
  | "garden-picnic"
  | "celebration-glow"
  | "picnic-daylight"
  | "cinema-noir"
  | "arcade-night"
  | "game-night-lounge"
  | "neutral-canvas";

const EVENT_BANNER_PRESET_IDS: EventBannerPresetId[] = [
  "editorial-escape",
  "backpacking-editorial",
  "metro-postcard",
  "birthday-confetti",
  "sunset-drive",
  "coastal-breeze",
  "alpine-air",
  "barbecue-embers",
  "ember-smoke",
  "candle-dinner",
  "garden-picnic",
  "celebration-glow",
  "picnic-daylight",
  "cinema-noir",
  "arcade-night",
  "game-night-lounge",
  "neutral-canvas",
];

function getTemplateDataRecord(event: Partial<Barbecue> | null | undefined): Record<string, unknown> {
  return event?.templateData && typeof event.templateData === "object"
    ? (event.templateData as Record<string, unknown>)
    : {};
}

function normalizeValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function normalizeEventBannerPresetId(value: unknown): EventBannerPresetId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim() as EventBannerPresetId;
  return EVENT_BANNER_PRESET_IDS.includes(normalized) ? normalized : null;
}

export function inferPlanHeroBannerPreset(
  event: Pick<Partial<Barbecue>, "eventType" | "countryCode" | "city" | "templateData"> | null | undefined,
): EventBannerPresetId {
  const templateData = getTemplateDataRecord(event);
  const mainCategory = normalizeValue(templateData.mainCategory ?? templateData.privateMainCategory);
  const subCategory = normalizeValue(templateData.subCategory ?? templateData.privateSubCategory ?? templateData.privateEventTypeId);
  const eventType = normalizeValue(event?.eventType);

  const key = subCategory ?? eventType;

  switch (key) {
    case "backpacking":
      return "backpacking-editorial";
    case "hiking_trip":
    case "camping":
    case "other_trip":
      return "editorial-escape";
    case "city_trip":
    case "workation":
    case "business_trip":
      return "metro-postcard";
    case "road_trip":
    case "roadtrip":
    case "weekend_escape":
    case "weekend_getaway":
      return "sunset-drive";
    case "beach_getaway":
    case "beach_trip":
    case "pool_party":
      return "coastal-breeze";
    case "ski_trip":
      return "alpine-air";
    case "barbecue":
      return "barbecue-embers";
    case "dinner":
    case "dinner_party":
      return "candle-dinner";
    case "birthday":
      return "birthday-confetti";
    case "house_party":
      return "celebration-glow";
    case "brunch":
      return "garden-picnic";
    case "day_out":
      return "picnic-daylight";
    case "cinema":
    case "movie_night":
      return "cinema-noir";
    case "game_night":
      return "game-night-lounge";
    case "festival_trip":
    case "after_party":
    case "drinks_night":
      return "arcade-night";
    default:
      break;
  }

  if (mainCategory === "trip") return "editorial-escape";
  if (mainCategory === "party") return "celebration-glow";
  return "neutral-canvas";
}
