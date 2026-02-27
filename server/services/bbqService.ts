import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { AppError, forbidden, upgradeRequired } from "../lib/errors";
import { auditLog } from "../lib/audit";
import { resolveTripCurrency } from "../lib/country-currency";
import { isPublicListingActive, slugifyPublicEvent } from "../lib/public-listing";
import type { Barbecue } from "@shared/schema";
import { isPublicEvent as isCanonicalPublicEvent } from "@shared/event-visibility";
import { normalizeCountryCode } from "@shared/lib/country-code";

const DEFAULT_LISTING_DURATION_DAYS = Number(process.env.PUBLIC_LISTING_DAYS ?? 30);
const warnedPrivatePollutionIds = new Set<number>();

function hasPublicIntentEvidence(event: Barbecue): boolean {
  if (event.visibility === "public") return true;
  if (event.publicSlug) return true;
  if ((event.status as string | undefined) === "draft") return true;
  if (event.organizationName || event.publicDescription || event.bannerImageUrl) return true;
  if ((event.publicTemplate as string | undefined) && event.publicTemplate !== "classic") return true;
  const tpl = event.templateData && typeof event.templateData === "object" ? (event.templateData as Record<string, unknown>) : null;
  return !!(tpl && (tpl.publicCategory || tpl.publicRsvpTiers || tpl.publicCapacity || tpl.publicExternalLink));
}

function shouldTreatAsPollutedPrivate(event: Barbecue): boolean {
  if (event.visibility === "public") return false;
  if ((event.visibilityOrigin as string | undefined) !== "public") return false;
  return !hasPublicIntentEvidence(event);
}

function privatePublicFieldChanges(event: Barbecue): Array<string> {
  const changes: string[] = [];
  if (event.visibility !== "private") changes.push("visibility");
  if ((event.visibilityOrigin as string | undefined) !== "private") changes.push("visibilityOrigin");
  if (event.publicListingStatus !== "inactive") changes.push("publicListingStatus");
  if (event.publicListFromAt) changes.push("publicListFromAt");
  if (event.publicListUntilAt) changes.push("publicListUntilAt");
  if (event.publicListingExpiresAt) changes.push("publicListingExpiresAt");
  if (event.publicSlug) changes.push("publicSlug");
  if (event.organizationName) changes.push("organizationName");
  if (event.publicDescription) changes.push("publicDescription");
  if (event.bannerImageUrl) changes.push("bannerImageUrl");
  if (event.publicMode !== "marketing") changes.push("publicMode");
  if (event.publicTemplate !== "classic") changes.push("publicTemplate");
  if (event.isPublic) changes.push("isPublic");
  return changes;
}

export function normalizeEventForClient(event: Barbecue): Barbecue {
  const privateCanonical = !isCanonicalPublicEvent(event);
  const suspiciousPollution = shouldTreatAsPollutedPrivate(event);
  if (!privateCanonical && !suspiciousPollution) return event;

  const normalized: Barbecue = {
    ...event,
    visibility: "private",
    visibilityOrigin: "private",
    isPublic: false,
    publicMode: "marketing",
    publicTemplate: "classic",
    publicListingStatus: "inactive",
    publicListFromAt: null,
    publicListUntilAt: null,
    publicListingExpiresAt: null,
    publicSlug: null,
    organizationName: null,
    publicDescription: null,
    bannerImageUrl: null,
  };

  if (process.env.NODE_ENV !== "production") {
    const changes = privatePublicFieldChanges(event);
    if (changes.length > 0 && !warnedPrivatePollutionIds.has(event.id)) {
      warnedPrivatePollutionIds.add(event.id);
      console.warn("[invariant] private event has public fields; ignoring + should be repaired", {
        eventId: event.id,
        changes,
        suspiciousOrigin: suspiciousPollution,
      });
    }
  }

  return normalized;
}

function stripPublicOnlyFieldsForPrivateMutation<T extends Record<string, unknown>>(target: T, privateOrigin: boolean): T {
  if (!privateOrigin) return target;
  return {
    ...target,
    visibility: "private",
    visibilityOrigin: "private",
    publicMode: "marketing",
    publicTemplate: "classic",
    publicListingStatus: "inactive",
    publicListFromAt: null,
    publicListUntilAt: null,
    publicListingExpiresAt: null,
    organizationName: null,
    publicDescription: null,
    bannerImageUrl: null,
  } as T;
}

function sanitizeLocationMeta(input: unknown): { city?: string; countryCode?: string; countryName?: string; lat?: number; lng?: number } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: { city?: string; countryCode?: string; countryName?: string; lat?: number; lng?: number } = {};
  if (typeof raw.city === "string" && raw.city.trim()) out.city = raw.city.trim();
  const countryCode = normalizeCountryCode(raw.countryCode);
  if (countryCode) out.countryCode = countryCode;
  if (typeof raw.countryName === "string" && raw.countryName.trim()) out.countryName = raw.countryName.trim();
  if (typeof raw.lat === "number" && Number.isFinite(raw.lat)) out.lat = raw.lat;
  if (typeof raw.lng === "number" && Number.isFinite(raw.lng)) out.lng = raw.lng;
  return Object.keys(out).length > 0 ? out : null;
}

export type PublicEventListItem = {
  id: number;
  title: string;
  date: string | null;
  city: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
  currencyCode: string;
  organizationName: string | null;
  subtitle: string | null;
  publicDescription: string | null;
  publicSlug: string;
  publicMode: "marketing" | "joinable";
  publicTemplate: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
  publicListingStatus: "inactive" | "active" | "expired" | "paused";
  publicListFromAt: string | null;
  publicListUntilAt: string | null;
  publicListingExpiresAt: string | null;
  themeCategory: "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other";
};

export type PublicEventDetail = PublicEventListItem & {
  locationName: string | null;
  bannerImageUrl: string | null;
  organizer: {
    handle: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    profileImageUrl: string | null;
    publicEventsHosted: number;
    verifiedHost: boolean;
  } | null;
  rsvpTiers: Array<{
    id: string;
    name: string;
    description: string | null;
    priceLabel: string | null;
    capacity: number | null;
    isFree: boolean;
  }>;
};

export type PublicEventLookupResult =
  | { status: "ok"; event: PublicEventDetail; eventId: number }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "expired" };

function requireListingForPublicVisibility(next: {
  visibility?: "private" | "public";
  publicListingStatus?: "inactive" | "active" | "expired" | "paused";
  publicListFromAt?: Date | null;
  publicListUntilAt?: Date | null;
  publicListingExpiresAt?: Date | null;
}, current?: Barbecue) {
  const visibility = next.visibility ?? (current?.visibility as "private" | "public" | undefined) ?? "private";
  if (visibility !== "public") return;
  const listingStatus = next.publicListingStatus ?? (current?.publicListingStatus as string | undefined) ?? "inactive";
  const listingExpiresAt =
    next.publicListingExpiresAt !== undefined ? next.publicListingExpiresAt : (current?.publicListingExpiresAt ?? null);
  const listFromAt =
    next.publicListFromAt !== undefined ? next.publicListFromAt : (current?.publicListFromAt ?? null);
  const listUntilAt =
    next.publicListUntilAt !== undefined ? next.publicListUntilAt : (current?.publicListUntilAt ?? null);
  if (!isPublicListingActive({ publicListingStatus: listingStatus, publicListingExpiresAt: listingExpiresAt, publicListFromAt: listFromAt, publicListUntilAt: listUntilAt })) {
    forbidden("Public listing requires activation");
  }
}

function requireVisibilityOriginAllowsPublic(next: {
  visibility?: "private" | "public";
  visibilityOrigin?: "private" | "public";
}, current?: Barbecue) {
  const targetVisibility = next.visibility ?? (current?.visibility as "private" | "public" | undefined);
  if (targetVisibility !== "public") return;
  const origin = next.visibilityOrigin ?? (current?.visibilityOrigin as "private" | "public" | undefined) ?? "public";
  if (origin === "private") {
    throw new AppError("EVENT_VISIBILITY_LOCKED", "This private event cannot be converted to public.", 400);
  }
}

function toPublicListItem(event: Barbecue): PublicEventListItem {
  const tpl = (event.templateData && typeof event.templateData === "object") ? event.templateData as Record<string, unknown> : null;
  const rawCategory = typeof tpl?.publicCategory === "string" ? tpl.publicCategory.toLowerCase() : "";
  const themeCategory =
    rawCategory === "party" || rawCategory === "networking" || rawCategory === "meetup" || rawCategory === "workshop" ||
    rawCategory === "conference" || rawCategory === "training" || rawCategory === "sports" || rawCategory === "other"
      ? rawCategory
      : (String(event.eventType ?? "").includes("party") || String(event.eventType ?? "") === "barbecue" ? "party" : "other");
  return {
    id: event.id,
    title: event.name,
    date: event.date ? event.date.toISOString() : null,
    city: event.city ?? null,
    countryName: event.countryName ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    currencyCode: event.currency ?? "EUR",
    organizationName: event.organizationName ?? null,
    subtitle: typeof tpl?.publicSubtitle === "string" && tpl.publicSubtitle.trim() ? tpl.publicSubtitle.trim() : null,
    publicDescription: event.publicDescription ?? null,
    publicSlug: event.publicSlug ?? "",
    publicMode: (event.publicMode as "marketing" | "joinable") ?? "marketing",
    publicTemplate: (event.publicTemplate as PublicEventListItem["publicTemplate"] | undefined) ?? "classic",
    publicListingStatus: (event.publicListingStatus as PublicEventListItem["publicListingStatus"] | undefined) ?? "inactive",
    publicListFromAt: event.publicListFromAt ? event.publicListFromAt.toISOString() : null,
    publicListUntilAt: event.publicListUntilAt ? event.publicListUntilAt.toISOString() : null,
    publicListingExpiresAt: event.publicListingExpiresAt ? event.publicListingExpiresAt.toISOString() : null,
    themeCategory: themeCategory as PublicEventListItem["themeCategory"],
  };
}

function parsePublicRsvpTiers(event: Barbecue): PublicEventDetail["rsvpTiers"] {
  const tpl = (event.templateData && typeof event.templateData === "object") ? (event.templateData as Record<string, unknown>) : null;
  const raw = Array.isArray(tpl?.publicRsvpTiers) ? tpl?.publicRsvpTiers : [];
  return raw
    .map((t): PublicEventDetail["rsvpTiers"][number] | null => {
      if (!t || typeof t !== "object") return null;
      const row = t as Record<string, unknown>;
      const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `tier-${Math.random().toString(36).slice(2, 8)}`;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!name) return null;
      return {
        id,
        name,
        description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
        priceLabel: typeof row.priceLabel === "string" && row.priceLabel.trim() ? row.priceLabel.trim() : null,
        capacity: typeof row.capacity === "number" && Number.isFinite(row.capacity) ? row.capacity : null,
        isFree: row.isFree === true || !row.priceLabel,
      };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .slice(0, 20);
}

export async function listBarbecues(currentUsername?: string, currentUserId?: number): Promise<Barbecue[]> {
  const rows = await bbqRepo.listAccessible(currentUsername, currentUserId);
  return rows.map(normalizeEventForClient);
}

export async function listPublicBarbecues(): Promise<Barbecue[]> {
  const rows = await bbqRepo.listPublic();
  return rows.map(normalizeEventForClient);
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
    eventVibe?: string;
    locationName?: string | null;
    locationText?: string | null;
    locationMeta?: unknown | null;
    city?: string | null;
    countryCode?: string | null;
    countryName?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
    currencySource?: "auto" | "manual";
    visibility?: "private" | "public";
    visibilityOrigin?: "private" | "public";
    publicMode?: "marketing" | "joinable";
    publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
    publicListingStatus?: "inactive" | "active" | "expired" | "paused";
    publicListFromAt?: Date | null;
    publicListUntilAt?: Date | null;
    publicListingExpiresAt?: Date | null;
    organizationName?: string | null;
    publicDescription?: string | null;
    bannerImageUrl?: string | null;
  },
  sessionUsername?: string
): Promise<Barbecue> {
  const creatorId = input.creatorId?.trim() || sessionUsername;
  const requestedVisibility = input.visibility ?? (input.isPublic ? "public" : "private");
  const visibilityOrigin = input.visibilityOrigin ?? (requestedVisibility === "public" ? "public" : "private");
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
  const normalizedCountryCode = normalizeCountryCode(input.countryCode);
  let currency = input.currency?.trim()?.toUpperCase();

  if (currencySource !== "manual" || !currency) {
    currency = resolveTripCurrency({
      countryCode: normalizedCountryCode,
      userDefaultCurrency: creatorUser?.defaultCurrencyCode,
    });
  }
  if (!currency?.trim()) {
    currency = creatorUser?.defaultCurrencyCode ?? "EUR";
  }

  requireVisibilityOriginAllowsPublic({ visibility: requestedVisibility, visibilityOrigin });
  requireListingForPublicVisibility(
    {
      visibility: requestedVisibility,
      publicListingStatus: input.publicListingStatus,
      publicListFromAt: input.publicListFromAt ?? null,
      publicListUntilAt: input.publicListUntilAt ?? null,
      publicListingExpiresAt: input.publicListingExpiresAt ?? null,
    },
  );

  const insertValues = stripPublicOnlyFieldsForPrivateMutation({
    ...input,
    date: typeof input.date === "string" ? new Date(input.date) : input.date,
    locationName: input.locationName ?? input.locationText ?? null,
    locationText: input.locationText ?? input.locationName ?? null,
    countryCode: normalizedCountryCode ?? null,
    locationMeta: sanitizeLocationMeta(input.locationMeta),
    currency: currency ?? "EUR",
    currencySource,
    visibility: requestedVisibility,
    visibilityOrigin,
    publicMode: input.publicMode ?? "marketing",
    publicTemplate: input.publicTemplate ?? "classic",
    publicListingStatus: input.publicListingStatus ?? "inactive",
    publicListFromAt: input.publicListFromAt ?? null,
    publicListUntilAt: input.publicListUntilAt ?? null,
    publicListingExpiresAt: input.publicListingExpiresAt ?? null,
    isPublic: requestedVisibility === "public",
    allowOptInExpenses: requestedVisibility === "private" ? input.allowOptInExpenses : false,
  } as Parameters<typeof bbqRepo.create>[0], visibilityOrigin === "private");
  const created = await bbqRepo.create(insertValues as Parameters<typeof bbqRepo.create>[0]);

  if (creatorId) {
    await participantRepo.create({
      barbecueId: created.id,
      name: creatorId,
      userId: creatorId,
      status: "accepted",
    });
  }
  auditLog("barbecue.create", { barbecueId: created.id, username: sessionUsername });
  if (visibilityOrigin === "public") {
    const withSlug = await ensurePublicSlug(created);
    if (!withSlug) return normalizeEventForClient(created);
    if (requestedVisibility === "public" && isPublicListingActive(withSlug)) {
      return normalizeEventForClient(withSlug);
    }
    return normalizeEventForClient(withSlug);
  }
  if (requestedVisibility === "public" && isPublicListingActive(created)) {
    return normalizeEventForClient((await ensurePublicSlug(created)) ?? created);
  }
  return normalizeEventForClient(created);
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
    latitude?: number | null;
    longitude?: number | null;
    placeId?: string | null;
    locationText?: string | null;
    locationMeta?: unknown | null;
    currency?: string;
    currencySource?: "auto" | "manual";
    eventType?: string;
    eventVibe?: string;
    visibility?: "private" | "public";
    visibilityOrigin?: "private" | "public";
    publicMode?: "marketing" | "joinable";
    publicTemplate?: "classic" | "keynote" | "workshop" | "nightlife" | "meetup";
    publicListingStatus?: "inactive" | "active" | "expired" | "paused";
    publicListFromAt?: Date | null;
    publicListUntilAt?: Date | null;
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
  requireVisibilityOriginAllowsPublic(
    {
      visibility: updates.visibility,
      visibilityOrigin: updates.visibilityOrigin,
    },
    bbq,
  );
  requireListingForPublicVisibility(
    {
      visibility: updates.visibility,
      publicListingStatus: updates.publicListingStatus,
      publicListFromAt: updates.publicListFromAt,
      publicListUntilAt: updates.publicListUntilAt,
      publicListingExpiresAt: updates.publicListingExpiresAt,
    },
    bbq,
  );

  const targetVisibility = (updates.visibility ?? bbq.visibility) as "private" | "public";
  const normalizedCountryCode = updates.countryCode !== undefined ? normalizeCountryCode(updates.countryCode) : undefined;
  const set: Parameters<typeof bbqRepo.update>[1] = {
    allowOptInExpenses: targetVisibility === "private" ? updates.allowOptInExpenses : false,
    templateData: updates.templateData,
    status: updates.status,
    settledAt: updates.settledAt,
    locationName: updates.locationName ?? updates.locationText,
    city: updates.city,
    countryCode: normalizedCountryCode,
    countryName: updates.countryName,
    latitude: updates.latitude,
    longitude: updates.longitude,
    placeId: updates.placeId,
    locationText: updates.locationText ?? updates.locationName,
    locationMeta: sanitizeLocationMeta(updates.locationMeta),
    eventType: updates.eventType,
    eventVibe: updates.eventVibe,
    visibility: updates.visibility,
    visibilityOrigin: updates.visibilityOrigin,
    publicMode: updates.publicMode,
    publicTemplate: updates.publicTemplate,
    publicListingStatus: updates.publicListingStatus,
    publicListFromAt: updates.publicListFromAt,
    publicListUntilAt: updates.publicListUntilAt,
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
      countryCode: normalizedCountryCode,
      userDefaultCurrency: creatorUser?.defaultCurrencyCode,
    });
  }

  let filtered = Object.fromEntries(Object.entries(set).filter(([, v]) => v !== undefined)) as Parameters<typeof bbqRepo.update>[1];
  const nextVisibilityOrigin = (filtered.visibilityOrigin ?? (bbq.visibilityOrigin as "private" | "public")) === "private";
  filtered = stripPublicOnlyFieldsForPrivateMutation(filtered, nextVisibilityOrigin);
  if (filtered.visibility === "public") {
    const withSlug = await ensurePublicSlug({ ...(bbq as Barbecue), ...(filtered as Partial<Barbecue>) } as Barbecue);
    if (withSlug?.publicSlug) filtered.publicSlug = withSlug.publicSlug;
  }
  const updated = await bbqRepo.update(id, filtered);
  return updated ? normalizeEventForClient(updated) : updated;
}

export async function getBarbecueIfAccessible(
  bbqId: number,
  userId?: number,
  username?: string
): Promise<Barbecue | null> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) return null;
  const hasAccess = await bbqRepo.hasAccess(bbq, username, userId);
  return hasAccess ? normalizeEventForClient(bbq) : null;
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
  const creator = event.creatorId ? await userRepo.findByUsername(event.creatorId) : undefined;
  const creatorProfile = event.creatorId ? await userRepo.getShareablePublicProfile(event.creatorId) : undefined;
  return {
    ...toPublicListItem(event),
    locationName: event.locationName ?? (event.city && event.countryName ? `${event.city}, ${event.countryName}` : null),
    bannerImageUrl: event.bannerImageUrl ?? null,
    organizer: creator ? {
      handle: creator.publicHandle ?? creator.username,
      username: creator.username,
      displayName: creator.displayName ?? null,
      avatarUrl: creator.avatarUrl ?? null,
      profileImageUrl: creator.profileImageUrl ?? null,
      publicEventsHosted: creatorProfile?.stats.publicEventsHosted ?? 0,
      verifiedHost: process.env.VITE_ENABLE_VERIFIED_HOST_BADGE === "true" || process.env.ENABLE_VERIFIED_HOST_BADGE === "true",
    } : null,
    rsvpTiers: parsePublicRsvpTiers(event),
  };
}

export async function getPublicEventBySlugForPublicView(slug: string): Promise<PublicEventLookupResult> {
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) return { status: "not_found" };
  if ((event.visibilityOrigin as string | undefined) === "private") return { status: "unavailable" };
  if (!event.publicSlug) return { status: "not_found" };

  const isListedAndVisible =
    event.visibility === "public" &&
    isPublicListingActive(event) &&
    event.publicListingStatus !== "paused";

  if (!isListedAndVisible) {
    const creator = event.creatorId ? await userRepo.findByUsername(event.creatorId) : undefined;
    const creatorProfile = event.creatorId ? await userRepo.getShareablePublicProfile(event.creatorId) : undefined;
    return {
      status: "ok",
      eventId: event.id,
      event: {
        ...toPublicListItem(event),
        locationName: event.locationName ?? (event.city && event.countryName ? `${event.city}, ${event.countryName}` : null),
        bannerImageUrl: event.bannerImageUrl ?? null,
        organizer: creator ? {
          handle: creator.publicHandle ?? creator.username,
          username: creator.username,
          displayName: creator.displayName ?? null,
          avatarUrl: creator.avatarUrl ?? null,
          profileImageUrl: creator.profileImageUrl ?? null,
          publicEventsHosted: creatorProfile?.stats.publicEventsHosted ?? 0,
          verifiedHost: process.env.ENABLE_VERIFIED_HOST_BADGE === "true",
        } : null,
        rsvpTiers: parsePublicRsvpTiers(event),
      },
    };
  }

  await bbqRepo.incrementPublicViewCount(event.id);

  const creator = event.creatorId ? await userRepo.findByUsername(event.creatorId) : undefined;
  const creatorProfile = event.creatorId ? await userRepo.getShareablePublicProfile(event.creatorId) : undefined;
  return {
    status: "ok",
    eventId: event.id,
    event: {
      ...toPublicListItem(event),
      locationName: event.locationName ?? (event.city && event.countryName ? `${event.city}, ${event.countryName}` : null),
      bannerImageUrl: event.bannerImageUrl ?? null,
        organizer: creator ? {
          handle: creator.publicHandle ?? creator.username,
          username: creator.username,
        displayName: creator.displayName ?? null,
        avatarUrl: creator.avatarUrl ?? null,
        profileImageUrl: creator.profileImageUrl ?? null,
        publicEventsHosted: creatorProfile?.stats.publicEventsHosted ?? 0,
        verifiedHost: process.env.ENABLE_VERIFIED_HOST_BADGE === "true",
      } : null,
      rsvpTiers: parsePublicRsvpTiers(event),
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
    publicListFromAt: event.publicListFromAt ?? null,
    publicListUntilAt: event.publicListUntilAt ?? null,
  });
  if (!updated) return undefined;
  const withSlug = await ensurePublicSlug(updated);
  return withSlug ?? updated;
}

export async function activateListingBySystem(
  id: number,
  options?: {
    expiresAt?: Date | null;
    publishAfterActivation?: boolean;
    publicMode?: "marketing" | "joinable";
  }
): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  const nextExpiry = options?.expiresAt ?? new Date(Date.now() + DEFAULT_LISTING_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const canPublish = options?.publishAfterActivation === true && (event.visibilityOrigin as string | undefined) !== "private";
  const updated = await bbqRepo.update(id, {
    publicListingStatus: "active",
    publicListingExpiresAt: nextExpiry,
    ...(canPublish ? { visibility: "public", publicMode: options?.publicMode ?? (event.publicMode as "marketing" | "joinable" | undefined) ?? "marketing" } : {}),
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
