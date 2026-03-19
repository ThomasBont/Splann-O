// Shared route helpers extracted from legacy bbqRoutes.
import type { Request } from "express";
import { z } from "zod";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import path from "path";
import { users, publicEventRsvps, participants, eventInvites, eventMembers, barbecues } from "@shared/schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import * as bbqService from "../services/bbqService";
import { db } from "../db";
import { log } from "../lib/logger";
import { AppError, badRequest, conflict, forbidden, notFound, unauthorized } from "../lib/errors";
import { resolveBaseUrl } from "../config/env";
import { getPlanLifecycleState, type CanonicalPlanStatus } from "../lib/planLifecycle";

/** Strip /api prefix for routers mounted at /api. */
export const p = (routePath: string) => (routePath.startsWith("/api") ? routePath.slice(4) : routePath);

export function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
}

export function escapeLikeQuery(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function getPublicRsvpTiersFromTemplateData(templateData: unknown) {
  const tpl = templateData && typeof templateData === "object" ? (templateData as Record<string, unknown>) : null;
  const raw = Array.isArray(tpl?.publicRsvpTiers) ? tpl.publicRsvpTiers : [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id.trim() : "";
      const name = typeof r.name === "string" ? r.name.trim() : "";
      if (!id || !name) return null;
      return {
        id,
        name,
        description: typeof r.description === "string" && r.description.trim() ? r.description.trim() : null,
        priceLabel: typeof r.priceLabel === "string" && r.priceLabel.trim() ? r.priceLabel.trim() : null,
        capacity: typeof r.capacity === "number" && Number.isFinite(r.capacity) ? r.capacity : null,
        isFree: r.isFree === true || !r.priceLabel,
      };
    })
    .filter((v): v is NonNullable<typeof v> => !!v)
    .slice(0, 20);
}

export async function getPublicEventForInboxOrThrow(eventId: number) {
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) notFound("Event not found");
  if ((bbq.visibilityOrigin as string | undefined) === "private") badRequest("EVENT_NOT_PUBLIC");
  return bbq;
}

export async function getInboxEligibility(eventId: number, userId: number, username?: string) {
  const bbq = await getPublicEventForInboxOrThrow(eventId);
  const organizer = bbq.creatorUserId ? await userRepo.findById(bbq.creatorUserId) : undefined;
  if (!organizer) notFound("Organizer not found");
  const isOrganizer = organizer.id === userId || (username && organizer.username === username);
  const participantRow = await db.select().from(participants)
    .where(and(eq(participants.barbecueId, eventId), eq(participants.userId, userId)));
  const rsvpRow = (await db.select().from(publicEventRsvps)
    .where(and(eq(publicEventRsvps.barbecueId, eventId), eq(publicEventRsvps.userId, userId))))[0];
  const hasJoinRequest = !!rsvpRow;
  const isApproved = !!participantRow[0] || !!rsvpRow && (rsvpRow.status === "approved" || rsvpRow.status === "going");
  const canMessageOrganizer = isOrganizer || hasJoinRequest || isApproved;
  return {
    bbq,
    organizer,
    isOrganizer,
    isApproved,
    hasJoinRequest,
    canMessageOrganizer,
    requestStatus: rsvpRow?.status ?? null,
  };
}

export function isAdmin(req: Request): boolean {
  const admins = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const username = (req.session?.username as string | undefined)?.toLowerCase();
  return !!username && admins.includes(username);
}

export async function getBarbecueOr404(req: Request, bbqId: number, message = "Event not found") {
  const bbq = await bbqService.getBarbecueIfAccessible(bbqId, req.session?.userId, req.session?.username);
  if (!bbq) notFound(message);
  return bbq;
}

export async function getPlanLifecycleOrThrow(eventId: number) {
  const lifecycle = await getPlanLifecycleState(eventId);
  if (!lifecycle) notFound("Event not found");
  return lifecycle;
}

type LifecycleMutationGuardConfig = {
  codePrefix: string;
  statusCode?: number;
  blockStatuses?: CanonicalPlanStatus[];
  archivedMessage?: string;
  settledMessage?: string;
  closedMessage?: string;
  blockIfSettlementStarted?: boolean;
  settlementStartedMessage?: string;
  requireSocialOpen?: boolean;
  socialClosedCode?: string;
  socialClosedMessage?: string | ((status: CanonicalPlanStatus) => string);
};

export async function assertPlanMutationAllowed(eventId: number, config: LifecycleMutationGuardConfig) {
  const lifecycle = await getPlanLifecycleOrThrow(eventId);
  const statusCode = config.statusCode ?? 409;
  const blockStatuses = new Set(config.blockStatuses ?? []);

  if (config.requireSocialOpen && !lifecycle.socialOpen) {
    const socialClosedCode = config.socialClosedCode ?? `${config.codePrefix}_social_closed`;
    const socialClosedMessage = typeof config.socialClosedMessage === "function"
      ? config.socialClosedMessage(lifecycle.status)
      : (config.socialClosedMessage ?? "This action is no longer available for this plan.");
    throw new AppError(socialClosedCode, socialClosedMessage, 403);
  }

  if (blockStatuses.has("archived") && lifecycle.status === "archived") {
    throw new AppError(`${config.codePrefix}_plan_archived`, config.archivedMessage ?? "Plan is archived.", statusCode);
  }
  if (blockStatuses.has("settled") && lifecycle.status === "settled") {
    throw new AppError(`${config.codePrefix}_plan_settled`, config.settledMessage ?? "Plan is settled.", statusCode);
  }
  if (blockStatuses.has("closed") && lifecycle.status === "closed") {
    throw new AppError(`${config.codePrefix}_plan_closed`, config.closedMessage ?? "Plan is closed.", statusCode);
  }
  if (config.blockIfSettlementStarted && lifecycle.settlementStarted) {
    throw new AppError(`${config.codePrefix}_settlement_started`, config.settlementStartedMessage ?? "Settlement already started.", statusCode);
  }

  return lifecycle;
}

export function getLifecycleErrorCode(action: "expenses" | "invites" | "members" | "chat", status: CanonicalPlanStatus, settlementStarted: boolean) {
  if (status === "archived") {
    return `${action}_locked_plan_archived`;
  }
  if (status === "settled") {
    return `${action}_locked_plan_settled`;
  }
  if (status === "closed") {
    return `${action}_locked_plan_closed`;
  }
  if (settlementStarted) {
    return `${action}_locked_settlement_started`;
  }
  return `${action}_locked`;
}

export async function assertExpensesWritable(eventId: number) {
  try {
    return await assertPlanMutationAllowed(eventId, {
      codePrefix: "expenses_locked",
      blockStatuses: ["archived", "settled", "closed"],
      archivedMessage: "Plan is archived. Expenses are read-only.",
      settledMessage: "Plan is settled. Expenses are read-only.",
      closedMessage: "Plan is closed. New expenses are no longer allowed.",
      blockIfSettlementStarted: true,
      settlementStartedMessage: "Settlement already started. Expenses are locked.",
    });
  } catch (error) {
    if (error instanceof AppError) conflict(error.message);
    throw error;
  }
}

export async function assertExpenseMutationsWritable(eventId: number) {
  return assertPlanMutationAllowed(eventId, {
    codePrefix: "expenses_locked",
    statusCode: 403,
    blockStatuses: ["archived", "settled"],
    archivedMessage: "This expense is locked because settlement has already been finalized.",
    settledMessage: "This expense is locked because settlement has already been finalized.",
    blockIfSettlementStarted: true,
    settlementStartedMessage: "This expense is locked because settlement is already in progress.",
  });
}

export async function assertInvitesWritable(eventId: number) {
  try {
    return await assertPlanMutationAllowed(eventId, {
      codePrefix: "invites_locked",
      blockStatuses: ["archived", "settled", "closed"],
      archivedMessage: "Plan is archived. Invites are disabled.",
      settledMessage: "Plan is settled. Invites are disabled.",
      closedMessage: "Plan is closed. Invites are disabled.",
      blockIfSettlementStarted: true,
      settlementStartedMessage: "Settlement already started. Invites are disabled.",
    });
  } catch (error) {
    if (error instanceof AppError) conflict(error.message);
    throw error;
  }
}

export async function assertMembersWritable(eventId: number) {
  try {
    return await assertPlanMutationAllowed(eventId, {
      codePrefix: "members_locked",
      blockStatuses: ["archived", "settled", "closed"],
      archivedMessage: "Plan is archived. Members are locked.",
      settledMessage: "Plan is settled. Members are locked.",
      closedMessage: "Plan is closed. Members are locked.",
      blockIfSettlementStarted: true,
      settlementStartedMessage: "Settlement already started. Members are locked.",
    });
  } catch (error) {
    if (error instanceof AppError) conflict(error.message);
    throw error;
  }
}

export async function assertArchivedPlanWritable(
  eventId: number,
  lockedMessage = "Plan is archived. This section is read-only.",
) {
  return assertPlanMutationAllowed(eventId, {
    codePrefix: "plan_locked",
    statusCode: 403,
    blockStatuses: ["archived"],
    archivedMessage: lockedMessage,
  });
}

export async function assertSettlementStartAllowed(eventId: number) {
  return assertPlanMutationAllowed(eventId, {
    codePrefix: "plan",
    blockStatuses: ["settled", "archived"],
    settledMessage: "This plan is already settled.",
    archivedMessage: "This plan is archived.",
  });
}

export async function assertSettlementWritable(eventId: number) {
  return assertPlanMutationAllowed(eventId, {
    codePrefix: "plan",
    blockStatuses: ["settled", "archived"],
    settledMessage: "Settled plans are read-only.",
    archivedMessage: "Archived plans are read-only.",
  });
}

export async function assertSocialMutationWritable(
  eventId: number,
  code = "SOCIAL_ACTIONS_CLOSED",
  message = "This action is no longer available for this plan.",
) {
  return assertPlanMutationAllowed(eventId, {
    codePrefix: "social",
    requireSocialOpen: true,
    socialClosedCode: code,
    socialClosedMessage: message,
  });
}

export async function ensurePrivateEventParticipantOrCreator(req: Request, bbqId: number) {
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibility !== "private") forbidden("Receipt uploads are only available for private events");
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  if (bbq.creatorUserId === userId) return bbq;
  const accepted = await participantRepo.listByBbq(bbqId, "accepted");
  const canAccess = accepted.some((p) => p.userId === userId);
  if (!canAccess) forbidden("Not a participant of this event");
  return bbq;
}

export async function isEventMemberUser(eventId: number, userId: number, username?: string | null): Promise<boolean> {
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) return false;
  if (bbq.creatorUserId === userId) return true;

  const rows = await db
    .select({ id: eventMembers.id })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);
  return !!rows[0];
}

export async function assertEventAccessOrThrow(req: Request, eventId: number) {
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const ok = await isEventMemberUser(eventId, userId, req.session?.username);
  if (!ok) forbidden("Not a member of this event");
}

export async function assertEventCreatorOrThrow(req: Request, eventId: number) {
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorUserId !== userId) {
    forbidden("Only the plan creator can perform this action");
  }
  return bbq;
}

export function getPublicBaseUrl(req: Request) {
  const forwardedProto = String(req.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    .trim();
  const forwardedHost = String(req.get("x-forwarded-host") ?? "")
    .split(",")[0]
    .trim();
  if (forwardedHost) {
    const proto = forwardedProto || req.protocol || "https";
    return resolveBaseUrl(`${proto}://${forwardedHost}`);
  }

  return resolveBaseUrl(`${req.protocol}://${req.get("host")}`);
}

export function toPublicUploadsUrl(req: Request, relativePath: string): string {
  const publicBaseUrl = getPublicBaseUrl(req);
  return new URL(relativePath, `${publicBaseUrl}/`).toString();
}

export const publicImagePathOrUrlSchema = z
  .string()
  .trim()
  .refine((value) => /^https?:\/\//i.test(value) || value.startsWith("/"), "Invalid image URL");

export const currencyCodeSchema = z.string().length(3, "currency must be ISO-4217 (3 chars)").transform((s) => s.toUpperCase());
export const visibilitySchema = z.enum(["private", "public"]);
export const visibilityOriginSchema = z.enum(["private", "public"]);
export const publicModeSchema = z.enum(["marketing", "joinable"]);
export const publicTemplateSchema = z.enum(["classic", "keynote", "workshop", "nightlife", "meetup"]);
export const listingStatusSchema = z.enum(["inactive", "active", "expired", "paused"]);
export const PRIVATE_MAIN_CATEGORIES = new Set(["trip", "party"]);
export const PRIVATE_SUBCATEGORIES_BY_MAIN: Record<string, Set<string>> = {
  trip: new Set(["backpacking", "city_trip", "workation", "road_trip", "roadtrip", "beach_getaway", "beach_trip", "ski_trip", "festival_trip", "weekend_escape", "weekend_getaway"]),
  party: new Set(["barbecue", "cinema", "cinema_night", "game_night", "dinner", "birthday", "house_party", "drinks_night", "club_night", "brunch", "picnic"]),
};

export function getEventBannerFileNameFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  if (!pathname.startsWith("/uploads/event-banners/")) return null;
  const fileName = path.basename(pathname);
  return fileName || null;
}

function isPrivateOrLoopbackIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateOrLoopbackIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80:")) return true;
  if (normalized === "::") return true;
  return false;
}

function isPrivateOrLoopbackIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrLoopbackIpv4(ip);
  if (version === 6) return isPrivateOrLoopbackIpv6(ip);
  return true;
}

export async function assertPublicRemoteUrlOrThrow(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    badRequest("Invalid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    badRequest("Only http(s) URLs are allowed");
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) {
    badRequest("Private hosts are not allowed");
  }
  if (isIP(host) && isPrivateOrLoopbackIp(host)) {
    badRequest("Private IP ranges are not allowed");
  }
  try {
    const records = await lookup(host, { all: true });
    if (!records.length) badRequest("Could not resolve remote host");
    const hasPrivate = records.some((record) => isPrivateOrLoopbackIp(record.address));
    if (hasPrivate) badRequest("Private IP ranges are not allowed");
  } catch {
    badRequest("Could not resolve remote host");
  }
  return parsed;
}

export const imageExtensionByMime: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export async function readImageResponseBodyWithLimit(res: Response, maxBytes: number): Promise<Buffer> {
  const body = res.body;
  if (!body) badRequest("Remote image has no body");
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) badRequest("Image must be 5MB or smaller");
    chunks.push(value);
  }
  if (total === 0) badRequest("Remote image is empty");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
}

export function isMissingSchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("does not exist") || message.includes("relation") || message.includes("column");
}

export function handleGuestRouteError(route: string, req: Request, err: unknown, res: { status: (code: number) => { json: (payload: object) => unknown } }): void {
  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
  log("error", "Guests route failed", {
    route,
    reqId: (req as Request & { requestId?: string }).requestId,
    userId: req.session?.userId,
    status,
    code,
    errorMessage: err instanceof Error ? err.message : String(err),
  });
  if (isMissingSchemaError(err)) {
    res.status(500).json({
      code: "DB_SCHEMA_NOT_MIGRATED",
      message: process.env.NODE_ENV === "production" ? "Internal Server Error" : "DB schema not migrated",
    });
    return;
  }
  throw err;
}

export async function listPendingPlanInvitesForUser(userId: number) {
  const me = await userRepo.findById(userId);
  if (!me) return [];
  const rows = await db
    .select()
    .from(eventInvites)
    .where(eq(eventInvites.status, "pending"))
    .orderBy(sql`${eventInvites.createdAt} desc`);

  const visible = rows.filter((invite) => {
    if (invite.acceptedByUserId && invite.acceptedByUserId === userId) return true;
    if (!invite.acceptedByUserId && invite.email && me.email) {
      return invite.email.toLowerCase() === me.email.toLowerCase();
    }
    return false;
  });

  const eventIds = Array.from(new Set(visible.map((invite) => invite.eventId)));
  const inviterIds = Array.from(new Set(
    visible.map((invite) => invite.inviterUserId).filter((id): id is number => id != null),
  ));

  const [events, inviters] = await Promise.all([
    eventIds.length > 0
      ? db.select({ id: barbecues.id, name: barbecues.name }).from(barbecues).where(inArray(barbecues.id, eventIds))
      : Promise.resolve([]),
    inviterIds.length > 0
      ? db
          .select({ id: users.id, displayName: users.displayName, username: users.username })
          .from(users)
          .where(inArray(users.id, inviterIds))
      : Promise.resolve([]),
  ]);

  const eventById = new Map(events.map((event) => [event.id, event]));
  const inviterById = new Map(inviters.map((inviter) => [inviter.id, inviter]));

  return visible.map((invite) => {
    const event = eventById.get(invite.eventId);
    const inviter = invite.inviterUserId ? inviterById.get(invite.inviterUserId) : null;
    return {
      id: invite.id,
      eventId: invite.eventId,
      eventName: event?.name ?? "Plan",
      inviterName: inviter?.displayName || inviter?.username || null,
      email: invite.email ?? null,
      status: invite.status,
      createdAt: invite.createdAt ? invite.createdAt.toISOString() : null,
    };
  });
}
