import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { AppError, forbidden, upgradeRequired } from "../lib/errors";
import { auditLog } from "../lib/audit";
import { resolveTripCurrency } from "../lib/country-currency";
import { isPublicListingActive, slugifyPublicEvent } from "../lib/public-listing";
import { db } from "../db";
import { eventMembers, eventChatMessages, expenseShares, expenses, participants, planActivity, type Barbecue } from "@shared/schema";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { inferPlanHeroBannerPreset, normalizeEventBannerPresetId } from "@shared/lib/plan-hero-banner";
import { computeSplit } from "@shared/lib/split/calc";
import { and, eq, inArray, sql } from "drizzle-orm";
import { resolveLegacyAssetIdToPublicPath } from "../lib/assets";
import { buildEffectiveExpenseShares } from "../lib/planBalancesRealtime";
import { fetchCanonicalPlace } from "../lib/googlePlaces";
import { resolveGoogleTimezoneId } from "../lib/googleTimezone";

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

function resolveBannerUrlFromAsset(assetId?: string | null): string | null {
  return resolveLegacyAssetIdToPublicPath(assetId);
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
  if (event.publicMode !== "marketing") changes.push("publicMode");
  if (event.publicTemplate !== "classic") changes.push("publicTemplate");
  if (event.isPublic) changes.push("isPublic");
  return changes;
}

export function normalizeEventForClient(event: Barbecue): Barbecue {
  const withResolvedBanner: Barbecue = event.bannerImageUrl || !event.bannerAssetId
    ? event
    : { ...event, bannerImageUrl: resolveBannerUrlFromAsset(event.bannerAssetId) };
  const suspiciousPollution = shouldTreatAsPollutedPrivate(event);
  if (!suspiciousPollution) return withResolvedBanner;

  const normalized: Barbecue = {
    ...withResolvedBanner,
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
  } as T;
}

function sanitizeLocationMeta(input: unknown): { city?: string; countryCode?: string; countryName?: string; lat?: number; lng?: number; locationCurrency?: string } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const out: { city?: string; countryCode?: string; countryName?: string; lat?: number; lng?: number; locationCurrency?: string } = {};
  if (typeof raw.city === "string" && raw.city.trim()) out.city = raw.city.trim();
  const countryCode = normalizeCountryCode(raw.countryCode);
  if (countryCode) out.countryCode = countryCode;
  if (typeof raw.countryName === "string" && raw.countryName.trim()) out.countryName = raw.countryName.trim();
  if (typeof raw.lat === "number" && Number.isFinite(raw.lat)) out.lat = raw.lat;
  if (typeof raw.lng === "number" && Number.isFinite(raw.lng)) out.lng = raw.lng;
  if (typeof raw.locationCurrency === "string") {
    const locationCurrency = raw.locationCurrency.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(locationCurrency)) out.locationCurrency = locationCurrency;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseLocalDateParts(localDate: string | null | undefined): { year: number; month: number; day: number } | null {
  if (typeof localDate !== "string") return null;
  const value = localDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseLocalTimeParts(localTime: string | null | undefined): { hour: number; minute: number } | null {
  if (typeof localTime !== "string") return null;
  const value = localTime.trim();
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    pick("year"),
    pick("month") - 1,
    pick("day"),
    pick("hour"),
    pick("minute"),
    pick("second"),
  );
  return asUtc - instant.getTime();
}

function localDateTimeToUtc(localDate: string, localTime: string, timeZone: string): Date | null {
  const date = parseLocalDateParts(localDate);
  const time = parseLocalTimeParts(localTime);
  if (!date || !time) return null;
  let utcMs = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timeZone);
    const nextUtcMs = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, 0) - offsetMs;
    if (Math.abs(nextUtcMs - utcMs) < 1000) {
      utcMs = nextUtcMs;
      break;
    }
    utcMs = nextUtcMs;
  }
  const result = new Date(utcMs);
  if (!Number.isFinite(result.getTime())) return null;
  return result;
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

type BarbecueListItem = Barbecue & {
  participantCount: number;
  expenseTotal: number;
  lastActivityAt: string | null;
  unreadCount: number;
  myBalance: number | null;
  participantPreview: Array<{ id: number; name: string }>;
};

export async function listBarbecues(currentUsername?: string, currentUserId?: number): Promise<BarbecueListItem[]> {
  const rows = await bbqRepo.listAccessible(currentUsername, currentUserId);
  const normalized = rows.map(normalizeEventForClient);
  const eventIds = normalized.map((row) => row.id).filter((id): id is number => Number.isInteger(id));
  if (eventIds.length === 0) return [];

  const [participantCounts, expenseTotals, lastChatActivity, lastPlanActivity, unreadByEvent, participantRows, expenseRows, expenseShareRows] = await Promise.all([
    db
      .select({
        eventId: participants.barbecueId,
        count: sql<number>`count(*)::int`,
      })
      .from(participants)
      .where(and(inArray(participants.barbecueId, eventIds), eq(participants.status, "accepted")))
      .groupBy(participants.barbecueId),
    db
      .select({
        eventId: expenses.barbecueId,
        total: sql<string>`coalesce(sum(${expenses.amount}), 0)::text`,
      })
      .from(expenses)
      .where(inArray(expenses.barbecueId, eventIds))
      .groupBy(expenses.barbecueId),
    db
      .select({
        eventId: eventChatMessages.eventId,
        lastAt: sql<string | null>`max(${eventChatMessages.createdAt})::text`,
      })
      .from(eventChatMessages)
      .where(
        and(
          inArray(eventChatMessages.eventId, eventIds),
          sql`${eventChatMessages.hiddenAt} is null`,
          sql`${eventChatMessages.deletedAt} is null`,
        ),
      )
      .groupBy(eventChatMessages.eventId),
    db
      .select({
        eventId: planActivity.eventId,
        lastAt: sql<string | null>`max(${planActivity.createdAt})::text`,
      })
      .from(planActivity)
      .where(inArray(planActivity.eventId, eventIds))
      .groupBy(planActivity.eventId),
    currentUserId
      ? db
        .select({
          eventId: planActivity.eventId,
          count: sql<number>`count(*)::int`,
        })
        .from(planActivity)
        .innerJoin(
          eventMembers,
          and(
            eq(eventMembers.eventId, planActivity.eventId),
            eq(eventMembers.userId, currentUserId),
          ),
        )
        .where(
          and(
            inArray(planActivity.eventId, eventIds),
            sql`${planActivity.createdAt} > coalesce(${eventMembers.lastReadActivityAt}, to_timestamp(0))`,
          ),
        )
        .groupBy(planActivity.eventId)
      : Promise.resolve([] as Array<{ eventId: number; count: number }>),
    db
      .select({
        eventId: participants.barbecueId,
        id: participants.id,
        name: participants.name,
        userId: participants.userId,
      })
      .from(participants)
      .where(and(inArray(participants.barbecueId, eventIds), eq(participants.status, "accepted"))),
    db
      .select({
        eventId: expenses.barbecueId,
        id: expenses.id,
        participantId: expenses.participantId,
        amount: expenses.amount,
        includedUserIds: expenses.includedUserIds,
      })
      .from(expenses)
      .where(inArray(expenses.barbecueId, eventIds)),
    db
      .select({
        eventId: expenses.barbecueId,
        expenseId: expenseShares.expenseId,
        participantId: expenseShares.participantId,
      })
      .from(expenseShares)
      .innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
      .where(inArray(expenses.barbecueId, eventIds)),
  ]);

  const participantCountByEvent = new Map(participantCounts.map((row) => [row.eventId, Number(row.count ?? 0)]));
  const expenseTotalByEvent = new Map(expenseTotals.map((row) => [row.eventId, Number(row.total ?? 0)]));
  const lastChatByEvent = new Map(lastChatActivity.map((row) => [row.eventId, row.lastAt]));
  const lastPlanActivityByEvent = new Map(lastPlanActivity.map((row) => [row.eventId, row.lastAt]));
  const unreadByEventMap = new Map(unreadByEvent.map((row) => [row.eventId, Number(row.count ?? 0)]));
  const participantsByEvent = new Map<number, Array<{ id: number; name: string; userId: number | null }>>();
  for (const row of participantRows) {
    const current = participantsByEvent.get(row.eventId);
    const normalizedRow = {
      id: row.id,
      name: row.name,
      userId: row.userId ?? null,
    };
    if (current) current.push(normalizedRow);
    else participantsByEvent.set(row.eventId, [normalizedRow]);
  }
  const expensesByEvent = new Map<number, Array<{ id: number; participantId: number; amount: number; includedUserIds: string[] | null }>>();
  for (const row of expenseRows) {
    const current = expensesByEvent.get(row.eventId);
    const normalizedRow = {
      id: row.id,
      participantId: row.participantId,
      amount: Number(row.amount),
      includedUserIds: row.includedUserIds ?? null,
    };
    if (current) current.push(normalizedRow);
    else expensesByEvent.set(row.eventId, [normalizedRow]);
  }
  const expenseSharesByEvent = new Map<number, Array<{ expenseId: number; participantId: number }>>();
  for (const row of expenseShareRows) {
    const current = expenseSharesByEvent.get(row.eventId);
    const normalizedRow = {
      expenseId: row.expenseId,
      participantId: row.participantId,
    };
    if (current) current.push(normalizedRow);
    else expenseSharesByEvent.set(row.eventId, [normalizedRow]);
  }

  return normalized.map((event) => {
    const eventParticipants = participantsByEvent.get(event.id) ?? [];
    const eventExpenses = expensesByEvent.get(event.id) ?? [];
    const eventExpenseShares = expenseSharesByEvent.get(event.id) ?? [];
    const effectiveExpenseShares = buildEffectiveExpenseShares({
      participants: eventParticipants,
      expenses: eventExpenses,
      legacyShares: eventExpenseShares,
      allowOptInExpenses: !!event.allowOptInExpenses,
    });
    const usesCustomSplit = !!event.allowOptInExpenses || eventExpenses.some((expense) => Array.isArray(expense.includedUserIds) && expense.includedUserIds.length > 0);
    const balances = eventParticipants.length > 0
      ? computeSplit(
        eventParticipants.map((participant) => ({ id: participant.id, name: participant.name })),
        eventExpenses.map((expense) => ({ id: expense.id, participantId: expense.participantId, amount: expense.amount })),
        effectiveExpenseShares,
        usesCustomSplit,
      ).balances
      : [];
    const myParticipant = currentUserId != null
      ? eventParticipants.find((participant) => participant.userId === currentUserId) ?? null
      : null;
    const myBalance = myParticipant
      ? balances.find((entry) => entry.id === myParticipant.id)?.balance ?? null
      : null;
    const lastCandidates = [
      lastChatByEvent.get(event.id),
      lastPlanActivityByEvent.get(event.id),
      event.updatedAt ? new Date(event.updatedAt).toISOString() : null,
      event.date ? new Date(event.date).toISOString() : null,
    ].filter((value): value is string => !!value);
    const lastActivityAt = lastCandidates
      .map((value) => ({ value, ms: new Date(value).getTime() }))
      .filter((row) => Number.isFinite(row.ms))
      .sort((a, b) => b.ms - a.ms)[0]?.value ?? null;

    return {
      ...event,
      participantCount: participantCountByEvent.get(event.id) ?? 0,
      expenseTotal: expenseTotalByEvent.get(event.id) ?? 0,
      lastActivityAt,
      unreadCount: unreadByEventMap.get(event.id) ?? 0,
      myBalance,
      participantPreview: eventParticipants.slice(0, 5).map((participant) => ({
        id: participant.id,
        name: participant.name,
      })),
    };
  });
}

export async function listPublicBarbecues(): Promise<Barbecue[]> {
  const rows = await bbqRepo.listPublic();
  return rows.map(normalizeEventForClient);
}

export async function createBarbecue(
  input: {
    name: string;
    date: Date | string;
    planCurrency?: string;
    currency?: string;
    localCurrency?: string | null;
    creatorId?: string | null;
    creatorUserId?: number | null;
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
    localDate?: string | null;
    localTime?: string | null;
    timezoneId?: string | null;
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
    bannerAssetId?: string | null;
    templateData?: unknown | null;
  },
  sessionUsername?: string
): Promise<Barbecue> {
  const canonicalPlace = input.placeId ? await fetchCanonicalPlace(input.placeId).catch(() => null) : null;
  const canonicalPlaceId = canonicalPlace?.placeId ?? input.placeId ?? null;
  const canonicalLocationName =
    canonicalPlace?.displayName
    ?? input.locationName
    ?? input.locationText
    ?? null;
  const canonicalFormattedAddress =
    canonicalPlace?.formattedAddress
    ?? input.locationText
    ?? input.locationName
    ?? null;
  const canonicalCity = canonicalPlace?.city ?? input.city ?? null;
  const canonicalCountryCode = canonicalPlace?.countryCode ?? normalizeCountryCode(input.countryCode) ?? null;
  const canonicalCountryName = canonicalPlace?.countryName ?? input.countryName ?? null;
  const canonicalLatitude = canonicalPlace?.latitude ?? input.latitude ?? null;
  const canonicalLongitude = canonicalPlace?.longitude ?? input.longitude ?? null;
  const parsedLocalDate = typeof input.localDate === "string" ? input.localDate.trim() : "";
  const parsedLocalTime = typeof input.localTime === "string" ? input.localTime.trim() : "";
  const localDateParts = parseLocalDateParts(parsedLocalDate);
  const localTimeParts = parseLocalTimeParts(parsedLocalTime);
  const timezoneLookupTimestamp = localDateParts
    ? Date.UTC(
      localDateParts.year,
      localDateParts.month - 1,
      localDateParts.day,
      localTimeParts?.hour ?? 12,
      localTimeParts?.minute ?? 0,
      0,
    ) / 1000
    : Math.floor((typeof input.date === "string" ? new Date(input.date) : input.date).getTime() / 1000) || Math.floor(Date.now() / 1000);
  const resolvedTimezoneId = (
    (typeof input.timezoneId === "string" ? input.timezoneId.trim() : "")
    || (
      Number.isFinite(canonicalLatitude)
      && Number.isFinite(canonicalLongitude)
      ? await resolveGoogleTimezoneId({
        latitude: Number(canonicalLatitude),
        longitude: Number(canonicalLongitude),
        timestampSeconds: timezoneLookupTimestamp,
      }).catch(() => null)
      : null
    )
    || null
  );
  const normalizedUtcStart =
    localDateParts && localTimeParts && resolvedTimezoneId
      ? localDateTimeToUtc(parsedLocalDate, parsedLocalTime, resolvedTimezoneId)
      : null;
  const fallbackDate =
    localDateParts
      ? new Date(Date.UTC(localDateParts.year, localDateParts.month - 1, localDateParts.day, 12, 0, 0))
      : (typeof input.date === "string" ? new Date(input.date) : input.date);

  const creatorId = input.creatorId?.trim() || sessionUsername;
  const creatorUserIdFromInput = input.creatorUserId ?? null;
  const requestedVisibility = input.visibility ?? (input.isPublic ? "public" : "private");
  const visibilityOrigin = input.visibilityOrigin ?? (requestedVisibility === "public" ? "public" : "private");
  let creatorUser: Awaited<ReturnType<typeof userRepo.findById>> | undefined;
  if (creatorUserIdFromInput) {
    creatorUser = await userRepo.findById(creatorUserIdFromInput);
  } else if (creatorId) {
    creatorUser = await userRepo.findByUsername(creatorId);
  }
  if (requestedVisibility === "public" && process.env.NODE_ENV !== "development") {
    const limits = getLimits(creatorUser ?? undefined);
    const count = creatorUser ? await bbqRepo.countOwnedByCreatorUserId(creatorUser.id) : 0;
    if (count >= limits.maxEvents) upgradeRequired("more_events", { current: count, max: limits.maxEvents });
  }

  const planCurrencyFromInput = input.planCurrency?.trim()?.toUpperCase() || input.currency?.trim()?.toUpperCase();
  const currencySource = input.currencySource ?? (planCurrencyFromInput ? "manual" : "auto");
  const normalizedCountryCode = normalizeCountryCode(canonicalCountryCode);
  const locationCurrency = resolveTripCurrency({
    countryCode: normalizedCountryCode,
    userDefaultCurrency: null,
  });
  let currency = planCurrencyFromInput;
  let localCurrency = input.localCurrency?.trim()?.toUpperCase() || null;

  if (currencySource !== "manual" || !currency) {
    currency = resolveTripCurrency({
      countryCode: normalizedCountryCode,
      userDefaultCurrency: creatorUser?.defaultCurrencyCode,
    });
  }
  if (!currency?.trim()) {
    currency = creatorUser?.defaultCurrencyCode ?? "EUR";
  }
  if (!localCurrency && locationCurrency && locationCurrency !== currency) {
    localCurrency = locationCurrency;
  }
  if (localCurrency && localCurrency === currency) {
    localCurrency = null;
  }

  const rawTemplateData = input.templateData && typeof input.templateData === "object"
    ? { ...(input.templateData as Record<string, unknown>) }
    : {};
  const currentBanner = rawTemplateData.banner && typeof rawTemplateData.banner === "object"
    ? { ...(rawTemplateData.banner as Record<string, unknown>) }
    : {};
  const presetId = normalizeEventBannerPresetId(currentBanner.presetId ?? rawTemplateData.privateBannerPreset)
    ?? inferPlanHeroBannerPreset({
      eventType: input.eventType ?? undefined,
      countryCode: normalizedCountryCode ?? undefined,
      city: canonicalCity ?? undefined,
      templateData: rawTemplateData,
    });
  const bannerMode = input.bannerImageUrl || input.bannerAssetId ? "uploaded" : "preset";
  const mergedTemplateData = {
    ...rawTemplateData,
    privateBannerPreset: presetId,
    banner: {
      ...currentBanner,
      mode: bannerMode,
      type: bannerMode === "uploaded" ? "upload" : "preset",
      presetId,
    },
  };

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
    creatorUserId: creatorUser?.id ?? null,
    date: normalizedUtcStart ?? fallbackDate,
    localDate: localDateParts ? parsedLocalDate : null,
    localTime: localTimeParts ? parsedLocalTime : null,
    timezoneId: resolvedTimezoneId,
    locationName: canonicalLocationName,
    locationText: canonicalFormattedAddress ?? canonicalLocationName,
    countryCode: normalizedCountryCode ?? null,
    locationMeta: sanitizeLocationMeta({
      ...(input.locationMeta && typeof input.locationMeta === "object" ? input.locationMeta as Record<string, unknown> : {}),
      city: canonicalCity,
      countryCode: normalizedCountryCode ?? undefined,
      countryName: canonicalCountryName ?? undefined,
      locationCurrency: normalizedCountryCode ? locationCurrency : undefined,
      lat: canonicalLatitude ?? undefined,
      lng: canonicalLongitude ?? undefined,
      placeId: canonicalPlaceId ?? undefined,
      formattedAddress: canonicalFormattedAddress ?? undefined,
      displayName: canonicalPlace?.displayName ?? undefined,
    }),
    city: canonicalCity,
    countryName: canonicalCountryName,
    latitude: canonicalLatitude,
    longitude: canonicalLongitude,
    placeId: canonicalPlaceId,
    templateData: mergedTemplateData,
    currency: currency ?? "EUR",
    localCurrency,
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
  if (process.env.NODE_ENV !== "production") {
    const meta = created.locationMeta && typeof created.locationMeta === "object"
      ? (created.locationMeta as Record<string, unknown>)
      : null;
    console.debug("[plan:create:currency]", {
      eventId: created.id,
      planCurrency: created.currency,
      locationCurrency: typeof meta?.locationCurrency === "string" ? meta.locationCurrency : null,
      localCurrency: created.localCurrency ?? null,
      countryCode: created.countryCode,
      creatorUserId: created.creatorUserId,
    });
  }

  if (creatorUser) {
    await participantRepo.create({
      barbecueId: created.id,
      name: creatorUser.displayName || creatorUser.username,
      userId: creatorUser.id,
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
    name?: string;
    date?: Date | string;
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
    localCurrency?: string | null;
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
    bannerAssetId?: string | null;
  },
  sessionUsername?: string,
  sessionUserId?: number,
): Promise<Barbecue | undefined> {
  const bbq = await bbqRepo.getById(id);
  if (!bbq) return undefined;
  let canEdit = !!sessionUserId && bbq.creatorUserId === sessionUserId;
  if (!canEdit && sessionUserId) {
    const rows = await db.select({ id: eventMembers.id }).from(eventMembers)
      .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, sessionUserId)))
      .limit(1);
    canEdit = !!rows[0];
  }
  if (!canEdit) return undefined;
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
    name: updates.name,
    date: updates.date ? (typeof updates.date === "string" ? new Date(updates.date) : updates.date) : undefined,
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
    bannerAssetId: updates.bannerAssetId,
  };

  if (updates.currency !== undefined) {
    set.currency = updates.currency;
    set.currencySource = updates.currencySource ?? "manual";
  }
  if (updates.localCurrency !== undefined) {
    const nextLocalCurrency = updates.localCurrency?.trim()?.toUpperCase() || null;
    set.localCurrency = nextLocalCurrency === set.currency ? null : nextLocalCurrency;
  } else if (updates.currencySource !== undefined) {
    set.currencySource = updates.currencySource;
  } else if (updates.countryCode !== undefined && bbq.currencySource === "auto") {
    const creatorUser = sessionUserId ? await userRepo.findById(sessionUserId) : undefined;
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
  const creator = event.creatorUserId ? await userRepo.findById(event.creatorUserId) : undefined;
  const creatorProfile = creator ? await userRepo.getShareablePublicProfile(creator.username) : undefined;
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
    const creator = event.creatorUserId ? await userRepo.findById(event.creatorUserId) : undefined;
    const creatorProfile = creator ? await userRepo.getShareablePublicProfile(creator.username) : undefined;
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

  const creator = event.creatorUserId ? await userRepo.findById(event.creatorUserId) : undefined;
  const creatorProfile = creator ? await userRepo.getShareablePublicProfile(creator.username) : undefined;
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

export async function activateListing(id: number, sessionUserId?: number): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  if (!sessionUserId || event.creatorUserId !== sessionUserId) return undefined;
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

export async function deactivateListing(id: number, sessionUserId?: number): Promise<Barbecue | undefined> {
  const event = await bbqRepo.getById(id);
  if (!event) return undefined;
  if (!sessionUserId || event.creatorUserId !== sessionUserId) return undefined;
  return bbqRepo.update(id, {
    publicListingStatus: "inactive",
    visibility: "private",
  });
}
