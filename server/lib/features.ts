/**
 * Feature gating by user plan.
 * Foundation for future monetization; no payment integration yet.
 */

export type UserPlan = "free" | "pro";

export interface UserWithPlan {
  id: number;
  plan?: UserPlan | string | null;
  planExpiresAt?: Date | null;
}

export type FeatureKey = "multi_currency" | "export_images" | "unlimited_events";

export type LimitKey = "events_created";

const FEATURE_MAP: Record<FeatureKey, { plans: UserPlan[] }> = {
  multi_currency: { plans: ["free", "pro"] },
  export_images: { plans: ["free", "pro"] },
  unlimited_events: { plans: ["pro"] },
};

/** Free tier limits. Pro = unlimited (or higher). */
const LIMIT_MAP: Record<LimitKey, { free: number; pro: number }> = {
  events_created: {
    free: parseInt(process.env.FREE_MAX_EVENTS ?? "10", 10),
    pro: Number.MAX_SAFE_INTEGER,
  },
};

function getEffectivePlan(user: UserWithPlan | null | undefined): UserPlan {
  if (!user) return "free";
  const plan: UserPlan = (user.plan as UserPlan) ?? "free";
  if (plan === "pro" && user.planExpiresAt && new Date() > user.planExpiresAt) {
    return "free";
  }
  return plan;
}

/** Check if user can use a feature. */
export function canUseFeature(user: UserWithPlan | null | undefined, feature: FeatureKey): boolean {
  if (!user) return false;
  const plan = getEffectivePlan(user);
  const { plans } = FEATURE_MAP[feature] ?? { plans: [] };
  return plans.includes(plan);
}

/** Check if user is within a limit. Returns { allowed, limit, current }. */
export function canUseLimit(
  user: UserWithPlan | null | undefined,
  limitName: LimitKey,
  currentCount: number
): { allowed: boolean; limit: number; current: number } {
  if (!user) return { allowed: false, limit: 0, current: currentCount };
  const plan = getEffectivePlan(user);
  const limits = LIMIT_MAP[limitName];
  const limit = limits ? limits[plan] ?? limits.free : 0;
  return { allowed: currentCount < limit, limit, current: currentCount };
}
