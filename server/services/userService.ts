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
    avatarAssetId?: string | null;
    profileImageUrl?: string | null;
    bio?: string | null;
    publicHandle?: string | null;
    publicProfileEnabled?: boolean;
    defaultEventType?: "private" | "public";
    preferredCurrencyCodes?: string[] | null;
    defaultCurrencyCode?: string;
    favoriteCurrencyCodes?: string[];
  }
) {
  const mapped: Record<string, unknown> = {};
  if (updates.displayName !== undefined) mapped.displayName = updates.displayName;
  if (updates.avatarUrl !== undefined) mapped.avatarUrl = updates.avatarUrl === "" ? null : updates.avatarUrl;
  if (updates.avatarAssetId !== undefined) mapped.avatarAssetId = updates.avatarAssetId === "" ? null : updates.avatarAssetId;
  if (updates.profileImageUrl !== undefined) mapped.profileImageUrl = updates.profileImageUrl === "" ? null : updates.profileImageUrl;
  if (updates.bio !== undefined) mapped.bio = updates.bio;
  if (updates.publicHandle !== undefined) mapped.publicHandle = updates.publicHandle;
  if (updates.publicProfileEnabled !== undefined) mapped.publicProfileEnabled = updates.publicProfileEnabled;
  if (updates.defaultEventType !== undefined) mapped.defaultEventType = updates.defaultEventType;
  if (updates.preferredCurrencyCodes !== undefined)
    mapped.preferredCurrencyCodes = updates.preferredCurrencyCodes === null ? null : JSON.stringify(updates.preferredCurrencyCodes);
  if (updates.defaultCurrencyCode !== undefined) mapped.defaultCurrencyCode = updates.defaultCurrencyCode;
  if (updates.favoriteCurrencyCodes !== undefined) mapped.favoriteCurrencyCodes = updates.favoriteCurrencyCodes;
  const user = await userRepo.updateProfile(userId, mapped as Parameters<typeof userRepo.updateProfile>[1]);
  if (!user) throw notFound("User not found");
  return serializeUser(user);
}

export async function deleteAccount(userId: number): Promise<void> {
  await userRepo.deleteUser(userId);
}
