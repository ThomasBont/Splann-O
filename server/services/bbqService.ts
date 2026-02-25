import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { upgradeRequired } from "../lib/errors";
import { auditLog } from "../lib/audit";
import { resolveTripCurrency } from "../lib/country-currency";
import type { Barbecue } from "@shared/schema";

export async function listBarbecues(currentUsername?: string, currentUserId?: number): Promise<Barbecue[]> {
  return bbqRepo.listAccessible(currentUsername, currentUserId);
}

export async function listPublicBarbecues(): Promise<Barbecue[]> {
  return bbqRepo.listPublic();
}

export async function createBarbecue(
  input: {
    name: string;
    date: Date | string;
    currency?: string;
    creatorId?: string | null;
    isPublic?: boolean;
    allowOptInExpenses?: boolean;
    area?: string;
    eventType?: string;
    locationName?: string | null;
    city?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    placeId?: string | null;
    currencySource?: "auto" | "manual";
  },
  sessionUsername?: string
): Promise<Barbecue> {
  const creatorId = input.creatorId?.trim() || sessionUsername;
  let creatorUser: Awaited<ReturnType<typeof userRepo.findByUsername>> | undefined;
  if (creatorId) {
    creatorUser = await userRepo.findByUsername(creatorId);
    const limits = getLimits(creatorUser ?? undefined);
    const count = await bbqRepo.countOwnedByCreator(creatorId);
    if (count >= limits.maxEvents) upgradeRequired("more_events", { current: count, max: limits.maxEvents });
  }

  const currencySource = input.currencySource ?? "auto";
  let currency = input.currency?.trim()?.toUpperCase();

  if (currencySource !== "manual" || !currency) {
    currency = resolveTripCurrency({
      countryCode: input.countryCode,
      userDefaultCurrency: creatorUser?.defaultCurrencyCode,
    });
  }
  if (!currency?.trim()) {
    currency = creatorUser?.defaultCurrencyCode ?? "EUR";
  }

  const created = await bbqRepo.create({
    ...input,
    date: typeof input.date === "string" ? new Date(input.date) : input.date,
    currency: currency ?? "EUR",
    currencySource,
  } as Parameters<typeof bbqRepo.create>[0]);

  if (creatorId) {
    await participantRepo.create({
      barbecueId: created.id,
      name: creatorId,
      userId: creatorId,
      status: "accepted",
    });
  }
  auditLog("barbecue.create", { barbecueId: created.id, username: sessionUsername });
  return created;
}

export async function updateBarbecue(
  id: number,
  updates: {
    allowOptInExpenses?: boolean;
    templateData?: unknown;
    status?: "draft" | "active" | "settling" | "settled";
    settledAt?: Date | null;
    locationName?: string | null;
    city?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    placeId?: string | null;
    currency?: string;
    currencySource?: "auto" | "manual";
  },
  sessionUsername?: string
): Promise<Barbecue | undefined> {
  const bbq = await bbqRepo.getById(id);
  if (!bbq) return undefined;
  if (bbq.creatorId !== sessionUsername) return undefined;

  const set: Parameters<typeof bbqRepo.update>[1] = {
    allowOptInExpenses: updates.allowOptInExpenses,
    templateData: updates.templateData,
    status: updates.status,
    settledAt: updates.settledAt,
    locationName: updates.locationName,
    city: updates.city,
    countryCode: updates.countryCode,
    countryName: updates.countryName,
    placeId: updates.placeId,
  };

  if (updates.currency !== undefined) {
    set.currency = updates.currency;
    set.currencySource = updates.currencySource ?? "manual";
  } else if (updates.currencySource !== undefined) {
    set.currencySource = updates.currencySource;
  } else if (updates.countryCode !== undefined && bbq.currencySource === "auto") {
    const creatorUser = sessionUsername ? await userRepo.findByUsername(sessionUsername) : undefined;
    set.currency = resolveTripCurrency({
      countryCode: updates.countryCode,
      userDefaultCurrency: creatorUser?.defaultCurrencyCode,
    });
  }

  const filtered = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined)) as Parameters<typeof bbqRepo.update>[1];
  return bbqRepo.update(id, filtered);
}

export async function getBarbecueIfAccessible(
  bbqId: number,
  userId?: number,
  username?: string
): Promise<Barbecue | null> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) return null;
  const hasAccess = await bbqRepo.hasAccess(bbq, username, userId);
  return hasAccess ? bbq : null;
}
