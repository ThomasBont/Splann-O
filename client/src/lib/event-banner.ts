import {
  inferPlanHeroBannerPreset,
  normalizeEventBannerPresetId,
  type EventBannerPresetId,
} from "@shared/lib/plan-hero-banner";
import type { Barbecue } from "@shared/schema";

export const EVENT_BANNER_PRESETS: Array<{
  id: EventBannerPresetId;
  label: string;
  className: string;
  tone: "light-content" | "dark-content";
  panelClassName: string;
}> = [
  { id: "editorial-escape", label: "Editorial escape", className: "bg-gradient-to-br from-[#f2ece1] via-[#ede5d7] to-[#e8dece]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(240,233,220,0.9),rgba(247,244,238,0.96))]" },
  { id: "backpacking-editorial", label: "Backpacking editorial", className: "bg-gradient-to-br from-[#f1ebdf] via-[#ebe2d3] to-[#e5dbca]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(239,231,215,0.92),rgba(247,244,238,0.97))]" },
  { id: "metro-postcard", label: "Metro postcard", className: "bg-gradient-to-br from-[#f0ebe2] via-[#e9e1d5] to-[#e1d8c9]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(236,229,217,0.9),rgba(247,244,238,0.97))]" },
  { id: "birthday-confetti", label: "Birthday confetti", className: "bg-gradient-to-br from-[#f4eee5] via-[#eee5d8] to-[#e6dccd]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(242,232,221,0.9),rgba(248,244,239,0.97))]" },
  { id: "sunset-drive", label: "Sunset drive", className: "bg-gradient-to-br from-[#f2ece0] via-[#ebe1d0] to-[#e2d6c1]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(240,230,214,0.9),rgba(247,244,238,0.97))]" },
  { id: "coastal-breeze", label: "Coastal breeze", className: "bg-gradient-to-br from-[#f1ebe1] via-[#ebe2d5] to-[#e3d9ca]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(238,231,220,0.9),rgba(247,244,238,0.97))]" },
  { id: "alpine-air", label: "Alpine air", className: "bg-gradient-to-br from-[#f0ebe3] via-[#e9e2d8] to-[#e0d8cd]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(237,232,223,0.9),rgba(247,244,239,0.97))]" },
  { id: "barbecue-embers", label: "Barbecue embers", className: "bg-gradient-to-br from-[#f1e8db] via-[#eadcc8] to-[#e0d0b7]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(238,226,206,0.92),rgba(247,244,238,0.97))]" },
  { id: "ember-smoke", label: "Ember smoke", className: "bg-gradient-to-br from-[#f1e9dd] via-[#ebdfcb] to-[#e2d4bc]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(239,228,210,0.92),rgba(247,244,238,0.97))]" },
  { id: "candle-dinner", label: "Candle dinner", className: "bg-gradient-to-br from-[#f3ece1] via-[#ece2d4] to-[#e3d8c7]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(241,233,220,0.92),rgba(248,244,239,0.97))]" },
  { id: "garden-picnic", label: "Garden picnic", className: "bg-gradient-to-br from-[#f1ede2] via-[#eae4d7] to-[#e1dacb]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(235,236,224,0.9),rgba(246,245,240,0.97))]" },
  { id: "celebration-glow", label: "Celebration glow", className: "bg-gradient-to-br from-[#f3ede4] via-[#ece3d7] to-[#e3d9cb]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(241,234,223,0.9),rgba(248,244,239,0.97))]" },
  { id: "picnic-daylight", label: "Picnic daylight", className: "bg-gradient-to-br from-[#f2eee3] via-[#ebe5d8] to-[#e2dbc9]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(234,236,224,0.9),rgba(246,245,240,0.97))]" },
  { id: "cinema-noir", label: "Cinema noir", className: "bg-gradient-to-br from-[#ece5d8] via-[#e3d8c5] to-[#d7cab3]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(226,224,226,0.92),rgba(243,241,239,0.97))]" },
  { id: "arcade-night", label: "Arcade night", className: "bg-gradient-to-br from-[#ede5d8] via-[#e3d8c6] to-[#d8cab5]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(229,224,218,0.92),rgba(244,241,238,0.97))]" },
  { id: "game-night-lounge", label: "Game night lounge", className: "bg-gradient-to-br from-[#ece4d6] via-[#e2d7c3] to-[#d6c8b2]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(229,223,215,0.92),rgba(244,241,238,0.97))]" },
  { id: "neutral-canvas", label: "Neutral canvas", className: "bg-gradient-to-br from-[#efeae2] via-[#e7dfd4] to-[#ddd4c6]", tone: "dark-content", panelClassName: "bg-[linear-gradient(180deg,rgba(236,232,226,0.92),rgba(245,243,240,0.97))]" },
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
  return normalizeEventBannerPresetId(
    typeof banner?.presetId === "string"
      ? banner.presetId
      : templateData.privateBannerPreset,
  ) ?? inferPlanHeroBannerPreset(event);
}

export function getBannerPresetClass(presetId: EventBannerPresetId | null | undefined): string | null {
  if (!presetId) return null;
  return EVENT_BANNER_PRESETS.find((preset) => preset.id === presetId)?.className ?? null;
}

export function getBannerPresetTone(presetId: EventBannerPresetId | null | undefined): "light-content" | "dark-content" | null {
  if (!presetId) return null;
  return EVENT_BANNER_PRESETS.find((preset) => preset.id === presetId)?.tone ?? null;
}

export function getBannerPresetPanelClass(presetId: EventBannerPresetId | null | undefined): string | null {
  if (!presetId) return null;
  return EVENT_BANNER_PRESETS.find((preset) => preset.id === presetId)?.panelClassName ?? null;
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
