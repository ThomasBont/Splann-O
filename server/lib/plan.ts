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

const FREE_MAX_EVENTS = parseInt(process.env.FREE_MAX_EVENTS ?? "3", 10);
const FREE_MAX_PARTICIPANTS = parseInt(process.env.FREE_MAX_PARTICIPANTS ?? "10", 10);

/** Get effective plan from user. Pro expires when planExpiresAt is past. */
export function getEffectivePlan(user: UserWithPlan | null | undefined): Plan {
  if (!user) return "free";
  const plan: Plan = (user.plan as Plan) ?? "free";
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
      maxEvents: Number.MAX_SAFE_INTEGER,
      maxParticipantsPerEvent: Number.MAX_SAFE_INTEGER,
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
