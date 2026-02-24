/**
 * Centralized plan logic for Free vs Pro.
 * Single source of truth for gating and limits. No Stripe yet.
 */

export type Plan = "free" | "pro";

export interface UserWithPlan {
  id: number;
  plan?: Plan | string | null;
  planExpiresAt?: Date | null;
}

export type FeatureKey =
  | "multi_currency"
  | "export_images"
  | "unlimited_events"
  | "no_export_watermark";

export interface PlanLimits {
  maxEvents: number;
  maxParticipantsPerEvent: number;
  exportImages: boolean;
  watermarkExports: boolean;
}

/** Parse env var as int; return fallback on NaN/invalid/non-positive. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

const FREE_MAX_EVENTS = envInt("FREE_MAX_EVENTS", 3);
const FREE_MAX_PARTICIPANTS = envInt("FREE_MAX_PARTICIPANTS", 10);

const PRO_MAX_EVENTS = 1_000_000;
const PRO_MAX_PARTICIPANTS = 1_000_000;

/** Get effective plan from user. Pro expires when planExpiresAt is past. */
export function getEffectivePlan(user: UserWithPlan | null | undefined): Plan {
  if (!user) return "free";
  const rawPlan = (user.plan ?? "free").toString().toLowerCase();
  const plan: Plan = rawPlan === "pro" ? "pro" : "free";
  if (plan === "pro" && user.planExpiresAt && new Date() > user.planExpiresAt) {
    return "free";
  }
  return plan;
}

/** Check if user can use a feature by plan. */
export function canUseFeature(
  user: UserWithPlan | null | undefined,
  featureKey: FeatureKey
): boolean {
  if (!user) return false;
  const plan = getEffectivePlan(user);
  switch (featureKey) {
    case "multi_currency":
    case "export_images":
      return true; // both plans
    case "unlimited_events":
    case "no_export_watermark":
      return plan === "pro";
    default:
      return false;
  }
}

/** Get plan limits for a user. */
export function getLimits(user: UserWithPlan | null | undefined): PlanLimits {
  const plan = getEffectivePlan(user ?? undefined);
  if (plan === "pro") {
    return {
      maxEvents: PRO_MAX_EVENTS,
      maxParticipantsPerEvent: PRO_MAX_PARTICIPANTS,
      exportImages: true,
      watermarkExports: false,
    };
  }
  return {
    maxEvents: FREE_MAX_EVENTS,
    maxParticipantsPerEvent: FREE_MAX_PARTICIPANTS,
    exportImages: true,
    watermarkExports: true,
  };
}
