import { userRepo } from "../repositories/userRepo";
import { getEffectivePlan, getLimits } from "../lib/plan";
import { notFound } from "../lib/errors";
import { serializeUser } from "./authService";

export async function getPlanInfo(userId: number) {
  const user = await userRepo.findById(userId);
  if (!user) throw notFound("User not found");
  const plan = getEffectivePlan(user);
  const limits = getLimits(user);
  return {
    plan,
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    limits: {
      maxEvents: limits.maxEvents,
      maxParticipantsPerEvent: limits.maxParticipantsPerEvent,
    },
    features: {
      exportImages: limits.exportImages,
      watermarkExports: limits.watermarkExports,
    },
  };
}

export async function updateProfile(
  userId: number,
  updates: {
    displayName?: string;
    avatarUrl?: string | null;
    profileImageUrl?: string | null;
    bio?: string | null;
    preferredCurrencyCodes?: string[] | null;
  }
) {
  const mapped: Record<string, unknown> = {};
  if (updates.displayName !== undefined) mapped.displayName = updates.displayName;
  if (updates.avatarUrl !== undefined) mapped.avatarUrl = updates.avatarUrl === "" ? null : updates.avatarUrl;
  if (updates.profileImageUrl !== undefined) mapped.profileImageUrl = updates.profileImageUrl === "" ? null : updates.profileImageUrl;
  if (updates.bio !== undefined) mapped.bio = updates.bio;
  if (updates.preferredCurrencyCodes !== undefined)
    mapped.preferredCurrencyCodes = updates.preferredCurrencyCodes === null ? null : JSON.stringify(updates.preferredCurrencyCodes);
  const user = await userRepo.updateProfile(userId, mapped as Parameters<typeof userRepo.updateProfile>[1]);
  if (!user) throw notFound("User not found");
  return serializeUser(user);
}

export async function deleteAccount(userId: number): Promise<void> {
  await userRepo.deleteUser(userId);
}
