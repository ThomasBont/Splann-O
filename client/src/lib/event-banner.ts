import type { Barbecue } from "@shared/schema";

export type EventBannerPresetId =
  | "warm-blush"
  | "sunset-glow"
  | "soft-plum"
  | "ocean-breeze"
  | "mint-haze"
  | "neutral-sand"
  | "peach-bloom"
  | "twilight-indigo";

export const EVENT_BANNER_PRESETS: Array<{
  id: EventBannerPresetId;
  label: string;
  className: string;
}> = [
  { id: "warm-blush", label: "Warm pink", className: "bg-gradient-to-br from-rose-300/40 via-pink-300/35 to-rose-200/30" },
  { id: "sunset-glow", label: "Sunset orange", className: "bg-gradient-to-br from-amber-300/40 via-orange-300/35 to-rose-300/30" },
  { id: "soft-plum", label: "Soft purple", className: "bg-gradient-to-br from-violet-300/35 via-fuchsia-300/25 to-purple-300/30" },
  { id: "ocean-breeze", label: "Ocean blue", className: "bg-gradient-to-br from-sky-300/40 via-cyan-300/30 to-blue-300/30" },
  { id: "mint-haze", label: "Mint green", className: "bg-gradient-to-br from-emerald-300/35 via-teal-300/30 to-lime-300/25" },
  { id: "neutral-sand", label: "Neutral beige", className: "bg-gradient-to-br from-amber-100/80 via-stone-100/80 to-zinc-100/80 dark:from-stone-800/60 dark:via-zinc-800/50 dark:to-neutral-800/50" },
  { id: "peach-bloom", label: "Peach bloom", className: "bg-gradient-to-br from-orange-200/40 via-rose-200/35 to-amber-100/40" },
  { id: "twilight-indigo", label: "Twilight indigo", className: "bg-gradient-to-br from-indigo-300/35 via-blue-300/30 to-violet-300/25" },
];

function getTemplateDataRecord(event: Partial<Barbecue> | null | undefined): Record<string, unknown> {
  return event?.templateData && typeof event.templateData === "object"
    ? (event.templateData as Record<string, unknown>)
    : {};
}

export function getBannerPresetIdFromEvent(event: Partial<Barbecue> | null | undefined): EventBannerPresetId | null {
  const templateData = getTemplateDataRecord(event);
  const banner = templateData.banner && typeof templateData.banner === "object"
    ? (templateData.banner as Record<string, unknown>)
    : null;
  const candidate = typeof banner?.presetId === "string"
    ? banner.presetId
    : typeof templateData.privateBannerPreset === "string"
      ? templateData.privateBannerPreset
      : null;
  if (!candidate) return null;
  return EVENT_BANNER_PRESETS.some((preset) => preset.id === candidate) ? (candidate as EventBannerPresetId) : null;
}

export function getBannerPresetClass(presetId: EventBannerPresetId | null | undefined): string | null {
  if (!presetId) return null;
  return EVENT_BANNER_PRESETS.find((preset) => preset.id === presetId)?.className ?? null;
}

export function getEventBanner(event: Partial<Barbecue> | null | undefined): {
  uploadedUrl: string | null;
  presetId: EventBannerPresetId | null;
} {
  return {
    uploadedUrl: event?.bannerImageUrl ?? null,
    presetId: getBannerPresetIdFromEvent(event),
  };
}
