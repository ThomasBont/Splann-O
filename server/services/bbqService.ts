import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { forbidden, upgradeRequired } from "../lib/errors";
import { auditLog } from "../lib/audit";
import { resolveTripCurrency } from "../lib/country-currency";
import { isPublicListingActive, slugifyPublicEvent } from "../lib/public-listing";
import type { Barbecue } from "@shared/schema";

const DEFAULT_LISTING_DURATION_DAYS = Number(process.env.PUBLIC_LISTING_DAYS ?? 30);

export type PublicEventListItem = {
  id: number;
  title: string;
  date: string | null;
  city: string | null;
  countryName: string | null;
  currencyCode: string;
  organizationName: string | null;
  publicDescription: string | null;
  publicSlug: string;
  publicMode: "marketing" | "joinable";
};

export type PublicEventDetail = PublicEventListItem & {
  locationName: string | null;
  bannerImageUrl: string | null;
};

export type PublicEventLookupResult =
  | { status: "ok"; event: PublicEventDetail; eventId: number }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "expired" };

function requireListingForPublicVisibility(next: {
  visibility?: "private" | "public";
  publicListingStatus?: "inactive" | "active" | "expired";
  publicListingExpiresAt?: Date | null;
}, current?: Barbecue) {
  const visibility = next.visibility ?? (current?.visibility as "private" | "public" | undefined) ?? "private";
  if (visibility !== "public") return;
  const listingStatus = next.publicListingStatus ?? (current?.publicListingStatus as string | undefined) ?? "inactive";
  const listingExpiresAt =
    next.publicListingExpiresAt !== undefined ? next.publicListingExpiresAt : (current?.publicListingExpiresAt ?? null);
  if (!isPublicListingActive({ publicListingStatus: listingStatus, publicListingExpiresAt: listingExpiresAt })) {
    forbidden("Public listing requires activation");
  }
}

function toPublicListItem(event: Barbecue): PublicEventListItem {
  return {
    id: event.id,
    title: event.name,
    date: event.date ? event.date.toISOString() : null,
    city: event.city ?? null,
    countryName: event.countryName ?? null,
    currencyCode: event.currency ?? "EUR",
    organizationName: event.organizationName ?? null,
    publicDescription: event.publicDescription ?? null,
    publicSlug: event.publicSlug ?? "",
    publicMode: (event.publicMode as "marketing" | "joinable") ?? "marketing",
  };
}

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
    visibility?: "private" | "public";
    publicMode?: "marketing" | "joinable";
    publicListingStatus?: "inactive" | "active" | "expired";
    publicListingExpiresAt?: Date | null;
    organizationName?: string | null;
    publicDescription?: string | null;
    bannerImageUrl?: string | null;
  },
  sessionUsername?: string
): Promise<Barbecue> {
  const creatorId = input.creatorId?.trim() || sessionUsername;
  const requestedVisibility = input.visibility ?? (input.isPublic ? "public" : "private");
  let creatorUser: Awaited<ReturnType<typeof userRepo.findByUsername>> | undefined;
  if (creatorId) {
    creatorUser = await userRepo.findByUsername(creatorId);
    if (requestedVisibility === "public" && process.env.NODE_ENV !== "development") {
      const limits = getLimits(creatorUser ?? undefined);
      const count = await bbqRepo.countOwnedByCreator(creatorId);
      if (count >= limits.maxEvents) upgradeRequired("more_events", { current: count, max: limits.maxEvents });
    }
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

  requireListingForPublicVisibility(
    {
      visibility: requestedVisibility,
      publicListingStatus: input.publicListingStatus,
      publicListingExpiresAt: input.publicListingExpiresAt ?? null,
    },
  );

  const created = await bbqRepo.create({
    ...input,
    date: typeof input.date === "string" ? new Date(input.date) : input.date,
    currency: currency ?? "EUR",
    currencySource,
    visibility: requestedVisibility,
    publicMode: input.publicMode ?? "marketing",
    publicListingStatus: input.publicListingStatus ?? "inactive",
    publicListingExpiresAt: input.publicListingExpiresAt ?? null,
    isPublic: requestedVisibility === "public",
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
  if (requestedVisibility === "public" && isPublicListingActive(created)) {
    return (await ensurePublicSlug(created)) ?? created;
  }
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
    visibility?: "private" | "public";
    publicMode?: "marketing" | "joinable";
    publicListingStatus?: "inactive" | "active" | "expired";
    publicListingExpiresAt?: Date | null;
    organizationName?: string | null;
    publicDescription?: string | null;
    bannerImageUrl?: string | null;
  },
  sessionUsername?: string
): Promise<Barbecue | undefined> {
  const bbq = await bbqRepo.getById(id);
  if (!bbq) return undefined;
  if (bbq.creatorId !== sessionUsername) return undefined;
  requireListingForPublicVisibility(
    {
      visibility: updates.visibility,
      publicListingStatus: updates.publicListingStatus,
      publicListingExpiresAt: updates.publicListingExpiresAt,
    },
    bbq,
  );

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
    visibility: updates.visibility,
    publicMode: updates.publicMode,
    publicListingStatus: updates.publicListingStatus,
    publicListingExpiresAt: updates.publicListingExpiresAt,
    organizationName: updates.organizationName,
    publicDescription: updates.publicDescription,
    bannerImageUrl: updates.bannerImageUrl,
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
  if (filtered.visibility === "public") {
    const withSlug = await ensurePublicSlug({ ...(bbq as Barbecue), ...(filtered as Partial<Barbecue>) } as Barbecue);
    if (withSlug?.publicSlug) filtered.publicSlug = withSlug.publicSlug;
  }
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

export async function ensurePublicSlug(event: Barbecue): Promise<Barbecue | undefined> {
  if (event.publicSlug) return event;
  const base = slugifyPublicEvent(`${event.name}-${event.id}`);
  let candidate = base;
  let i = 0;
  while (i < 20) {
    const existing = await bbqRepo.getByPublicSlug(candidate);
    if (!existing || existing.id === event.id) {
      return bbqRepo.update(event.id, { publicSlug: candidate });
    }
    i += 1;
    candidate = `${base}-${i + 1}`;
  }
  return bbqRepo.update(event.id, { publicSlug: `${base}-${Date.now().toString(36)}` });
}

export { isPublicListingActive };

export async function listExploreEvents(): Promise<PublicEventListItem[]> {
  const rows = await bbqRepo.listExploreCandidates();
  return rows
    .filter((e) => e.visibility === "public")
    .filter((e) => isPublicListingActive(e))
    .filter((e) => !!e.publicSlug)
    .sort((a, b) => (b.date?.getTime?.() ?? 0) - (a.date?.getTime?.() ?? 0))
    .map(toPublicListItem);
}

export async function getPublicEventBySlug(slug: string): Promise<PublicEventDetail | null> {
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) return null;
  if (event.visibility !== "public" || !isPublicListingActive(event) || !event.publicSlug) return null;
  return {
    ...toPublicListItem(event),
    locationName: event.locationName ?? (event.city && event.countryName ? `${event.city}, ${event.countryName}` : null),
    bannerImageUrl: event.bannerImageUrl ?? null,
  };
}

export async function getPublicEventBySlugForPublicView(slug: string): Promise<PublicEventLookupResult> {
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) return { status: "not_found" };
  if (event.visibility !== "public") return { status: "unavailable" };
  if (event.publicListingStatus !== "active") return { status: "unavailable" };
  if (!event.publicListingExpiresAt) return { status: "unavailable" };
  if (event.publicListingExpiresAt.getTime() <= Date.now()) return { status: "expired" };
  if (!event.publicSlug) return { status: "not_found" };

  await bbqRepo.incrementPublicViewCount(event.id);

  return {
    status: "ok",
    eventId: event.id,
    event: {
      ...toPublicListItem(event),
      locationName: event.locationName ?? (event.city && event.countryName ? `${event.city}, ${event.countryName}` : null),
      bannerImageUrl: event.bannerImageUrl ?? null,
    },
  };
}

export async function activateListing(id: number, sessionUsername?: string): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  if (event.creatorId !== sessionUsername) return undefined;
  const expiresAt = new Date(Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const updated = await bbqRepo.update(id, {
    publicListingStatus: "active",
    publicListingExpiresAt: expiresAt,
  });
  if (!updated) return undefined;
  const withSlug = await ensurePublicSlug(updated);
  return withSlug ?? updated;
}

export async function activateListingBySystem(id: number, expiresAt?: Date | null): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  const nextExpiry = expiresAt ?? new Date(Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const updated = await bbqRepo.update(id, {
    publicListingStatus: "active",
    publicListingExpiresAt: nextExpiry,
  });
  if (!updated) return undefined;
  return (await ensurePublicSlug(updated)) ?? updated;
}

export async function deactivateListing(id: number, sessionUsername?: string): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  if (event.creatorId !== sessionUsername) return undefined;
  return bbqRepo.update(id, {
    publicListingStatus: "inactive",
    visibility: "private",
  });
}
