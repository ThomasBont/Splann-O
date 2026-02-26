import type { Barbecue } from "@shared/schema";

export type CirclePersonality = "cozy" | "fun" | "chaotic" | "minimal";

export type CircleMoodTokens = {
  personality: CirclePersonality;
  backgroundTintClass: string;
  accentClass: string;
  ringClass: string;
  hoverScaleClass: string;
  motionDurationClass: string;
  motionIntensity: "soft" | "medium";
};

const TOKENS: Record<CirclePersonality, CircleMoodTokens> = {
  cozy: {
    personality: "cozy",
    backgroundTintClass: "bg-gradient-to-r from-primary/6 via-transparent to-accent/6",
    accentClass: "text-primary",
    ringClass: "ring-primary/10",
    hoverScaleClass: "hover:scale-[1.01]",
    motionDurationClass: "duration-150",
    motionIntensity: "soft",
  },
  fun: {
    personality: "fun",
    backgroundTintClass: "bg-gradient-to-r from-accent/8 via-primary/4 to-primary/8",
    accentClass: "text-accent",
    ringClass: "ring-accent/10",
    hoverScaleClass: "hover:scale-[1.01]",
    motionDurationClass: "duration-150",
    motionIntensity: "medium",
  },
  chaotic: {
    personality: "chaotic",
    backgroundTintClass: "bg-gradient-to-r from-primary/8 via-accent/7 to-primary/5",
    accentClass: "text-primary",
    ringClass: "ring-primary/15",
    hoverScaleClass: "hover:scale-[1.01]",
    motionDurationClass: "duration-150",
    motionIntensity: "medium",
  },
  minimal: {
    personality: "minimal",
    backgroundTintClass: "bg-gradient-to-r from-muted/40 via-transparent to-muted/30",
    accentClass: "text-foreground",
    ringClass: "ring-border/40",
    hoverScaleClass: "hover:scale-[1.005]",
    motionDurationClass: "duration-120",
    motionIntensity: "soft",
  },
};

export function getCircleMoodTokens(personality?: CirclePersonality | null): CircleMoodTokens {
  return TOKENS[personality ?? "cozy"] ?? TOKENS.cozy;
}

export function getDefaultCirclePersonality(input: {
  area?: string | null;
  eventType?: string | null;
}): CirclePersonality {
  const area = input.area ?? "";
  const eventType = input.eventType ?? "";
  if (area === "trips") return "fun";
  if (eventType.includes("house") || eventType.includes("room")) return "cozy";
  return "cozy";
}

export function getCirclePersonalityFromEvent(event: Pick<Barbecue, "area" | "eventType" | "templateData"> | null | undefined): CirclePersonality {
  const raw = (event?.templateData && typeof event.templateData === "object")
    ? (event.templateData as Record<string, unknown>)
    : null;
  const personality = raw?.personality;
  if (personality === "cozy" || personality === "fun" || personality === "chaotic" || personality === "minimal") {
    return personality;
  }
  return getDefaultCirclePersonality({ area: event?.area ?? null, eventType: event?.eventType ?? null });
}

