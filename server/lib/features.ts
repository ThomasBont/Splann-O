/**
 * Feature gating by user plan.
 * Foundation for future monetization; no payment integration yet.
 */

export type UserPlan = "free" | "pro";

export interface UserWithPlan {
  id: number;
  plan?: UserPlan | null;
  planExpiresAt?: Date | null;
}

export type FeatureKey = "multi_currency" | "export_images" | "unlimited_events";

const FEATURE_MAP: Record<FeatureKey, { plans: UserPlan[] }> = {
  multi_currency: { plans: ["free", "pro"] },
  export_images: { plans: ["free", "pro"] },
  unlimited_events: { plans: ["pro"] },
};

/** Check if user can use a feature. Default plan is "free" when plan is null/undefined. */
export function canUseFeature(user: UserWithPlan | null | undefined, feature: FeatureKey): boolean {
  if (!user) return false;
  const plan: UserPlan = (user.plan as UserPlan) ?? "free";
  if (plan === "pro" && user.planExpiresAt && new Date() > user.planExpiresAt) {
    return false;
  }
  const { plans } = FEATURE_MAP[feature] ?? { plans: [] };
  return plans.includes(plan);
}
