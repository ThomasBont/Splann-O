import { Router, type Request } from "express";
import { z } from "zod";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID, randomBytes } from "crypto";
import { api } from "@shared/routes";
import { users, expenses, notes, stripeEvents, publicEventRsvps, participants, eventMembers, eventInvites } from "@shared/schema";
import { optionalCountryCodeSchema } from "@shared/lib/country-code-schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { expenseRepo } from "../repositories/expenseRepo";
import { userRepo } from "../repositories/userRepo";
import { publicInboxRepo } from "../repositories/publicInboxRepo";
import { listEventChatMessages } from "../lib/eventChatStore";
import * as bbqService from "../services/bbqService";
import { requireAuth } from "../middleware/requireAuth";
import { publicRateLimit } from "../middleware/publicRateLimit";
import { checkPublicInboxRateLimit } from "../middleware/publicInboxRateLimit";
import { db } from "../db";
import { getLimits } from "../lib/plan";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { listPlanActivity, logPlanActivity } from "../lib/planActivity";
import { log } from "../lib/logger";
import { auditLog, auditSecurity } from "../lib/audit";
import { AppError, badRequest, conflict, forbidden, gone, notFound, unauthorized, upgradeRequired } from "../lib/errors";
import { createStripeCheckoutSession, verifyStripeWebhookSignature } from "../lib/stripe";

const router = Router();
const RECEIPT_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/receipts");
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const EVENT_BANNER_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/event-banners");
const MAX_EVENT_BANNER_SIZE_BYTES = 5 * 1024 * 1024;
const usersSearchRate = new Map<string, { count: number; windowStart: number }>();
const USERS_SEARCH_WINDOW_MS = 10_000;
const USERS_SEARCH_MAX_REQUESTS = 60;
const PRIVATE_MAIN_CATEGORIES = new Set(["trip", "party"]);
const PRIVATE_SUBCATEGORIES_BY_MAIN: Record<string, Set<string>> = {
  trip: new Set(["backpacking", "city_trip", "workation", "roadtrip", "beach_trip", "ski_trip", "festival_trip", "weekend_getaway"]),
  party: new Set(["barbecue", "cinema_night", "game_night", "dinner", "birthday", "house_party", "club_night", "picnic"]),
};

function escapeLikeQuery(raw: string): string {
  return raw
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

function getPublicRsvpTiersFromTemplateData(templateData: unknown) {
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

/** Strip /api prefix for router mounted at /api */
const p = (path: string) => (path.startsWith("/api") ? path.slice(4) : path);

function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
}

async function getPublicEventForInboxOrThrow(eventId: number) {
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) notFound("Event not found");
  if ((bbq.visibilityOrigin as string | undefined) === "private") badRequest("EVENT_NOT_PUBLIC");
  return bbq;
}

async function getInboxEligibility(eventId: number, userId: number, username?: string) {
  const bbq = await getPublicEventForInboxOrThrow(eventId);
  const organizer = bbq.creatorId ? await userRepo.findByUsername(bbq.creatorId) : undefined;
  if (!organizer) notFound("Organizer not found");
  const isOrganizer = organizer.id === userId || (username && bbq.creatorId === username);
  const participantRow = await db.select().from(participants)
    .where(and(eq(participants.barbecueId, eventId), eq(participants.invitedUserId, userId)));
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

function isAdmin(req: Request): boolean {
  const admins = (process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const username = (req.session?.username as string | undefined)?.toLowerCase();
  return !!username && admins.includes(username);
}

async function getBarbecueOr404(req: Request, bbqId: number, message = "Event not found") {
  const bbq = await bbqService.getBarbecueIfAccessible(bbqId, req.session?.userId, req.session?.username);
  if (!bbq) notFound(message);
  return bbq;
}

async function ensurePrivateEventParticipantOrCreator(req: Request, bbqId: number) {
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibility !== "private") forbidden("Receipt uploads are only available for private events");
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  if (bbq.creatorId === username) return bbq;
  const accepted = await participantRepo.listByBbq(bbqId, "accepted");
  const canAccess = accepted.some((p) => p.userId === username);
  if (!canAccess) forbidden("Not a participant of this event");
  return bbq;
}

async function isEventMemberUser(eventId: number, userId: number, username?: string | null): Promise<boolean> {
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) return false;
  if (bbq.creatorId) {
    const owner = await userRepo.findByUsername(bbq.creatorId);
    if (owner) {
      await db.insert(eventMembers).values({
        eventId,
        userId: owner.id,
        role: "owner",
        joinedAt: new Date(),
      }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    }
  }
  if (username && bbq.creatorId === username) {
    await db.insert(eventMembers).values({
      eventId,
      userId,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    return true;
  }

  const rows = await db
    .select({ id: eventMembers.id })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);
  return !!rows[0];
}

async function assertEventAccessOrThrow(req: Request, eventId: number) {
  const userId = req.session?.userId;
  const username = req.session?.username;
  if (!userId || !username) unauthorized("Not authenticated");
  const ok = await isEventMemberUser(eventId, userId, username);
  if (!ok) forbidden("Not a member of this event");
}

function getAppOrigin(req: Request) {
  return (process.env.APP_URL ?? process.env.APP_BASE_URL ?? "").replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
}

function isMissingSchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("does not exist") || message.includes("relation") || message.includes("column");
}

function handleGuestRouteError(route: string, req: Request, err: unknown, res: { status: (code: number) => { json: (payload: object) => unknown } }): void {
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

// Barbecues
router.get(p(api.barbecues.list.path), asyncHandler(async (req, res) => {
  const currentUsername = (req.session?.username as string) || (req.query.userId as string | undefined);
  const currentUserId = req.session?.userId;
  const items = await bbqService.listBarbecues(currentUsername, currentUserId);
  res.json(items);
}));

router.get(p(api.barbecues.listPublic.path), asyncHandler(async (_req, res) => {
  const items = await bbqService.listPublicBarbecues();
  res.json(items);
}));

const currencyCodeSchema = z.string().length(3, "currency must be ISO-4217 (3 chars)").transform((s) => s.toUpperCase());
const visibilitySchema = z.enum(["private", "public"]);
const visibilityOriginSchema = z.enum(["private", "public"]);
const publicModeSchema = z.enum(["marketing", "joinable"]);
const publicTemplateSchema = z.enum(["classic", "keynote", "workshop", "nightlife", "meetup"]);
const listingStatusSchema = z.enum(["inactive", "active", "expired", "paused"]);

router.post(p(api.barbecues.create.path), asyncHandler(async (req, res) => {
  const bodySchema = api.barbecues.create.input.extend({
    date: z.coerce.date(),
    eventType: z.string().optional(),
    eventVibe: z.string().optional(),
    locationText: z.string().nullable().optional(),
    locationMeta: z.unknown().nullable().optional(),
    countryCode: optionalCountryCodeSchema.nullable().optional(),
    latitude: z.coerce.number().finite().optional().nullable(),
    longitude: z.coerce.number().finite().optional().nullable(),
    currency: currencyCodeSchema.optional(),
    currencySource: z.enum(["auto", "manual"]).optional(),
    visibility: visibilitySchema.optional(),
    visibilityOrigin: visibilityOriginSchema.optional(),
    publicMode: publicModeSchema.optional(),
    publicTemplate: publicTemplateSchema.optional(),
    publicListingStatus: listingStatusSchema.optional(),
    publicListFromAt: z.coerce.date().nullable().optional(),
    publicListUntilAt: z.coerce.date().nullable().optional(),
    publicListingExpiresAt: z.coerce.date().nullable().optional(),
    organizationName: z.string().max(160).nullable().optional(),
    publicDescription: z.string().max(5000).nullable().optional(),
    bannerImageUrl: z.string().url().nullable().optional(),
  });
  const parsed = bodySchema.parse(req.body);
  if ((parsed.visibilityOrigin ?? "public") === "private" && parsed.templateData && typeof parsed.templateData === "object") {
    const templateData = parsed.templateData as Record<string, unknown>;
    const mainCategory = typeof templateData.mainCategory === "string" ? templateData.mainCategory : null;
    const subCategory = typeof templateData.subCategory === "string" ? templateData.subCategory : null;
    if (mainCategory && !PRIVATE_MAIN_CATEGORIES.has(mainCategory)) {
      badRequest("Invalid mainCategory");
    }
    if (mainCategory && subCategory) {
      const validSubcategories = PRIVATE_SUBCATEGORIES_BY_MAIN[mainCategory];
      if (!validSubcategories?.has(subCategory)) {
        badRequest("Invalid subCategory for mainCategory");
      }
    }
  }
  const input = {
    ...parsed,
    currencySource: (parsed.currencySource as "auto" | "manual" | undefined) ?? "auto",
  };
  const created = await bbqService.createBarbecue(input, req.session?.username);
  const ownerUserId = req.session?.userId ?? (req.session?.username ? (await userRepo.findByUsername(req.session.username))?.id : undefined);
  if (ownerUserId) {
    await db.insert(eventMembers).values({
      eventId: created.id,
      userId: ownerUserId,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
  }
  res.status(201).json(created);
}));

router.get("/explore/events", publicRateLimit(60, 60_000), asyncHandler(async (_req, res) => {
  const items = await bbqService.listExploreEvents();
  res.json(items);
}));

router.get("/public/events/:slug", publicRateLimit(60, 60_000), asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const result = await bbqService.getPublicEventBySlugForPublicView(slug);
  if (result.status === "expired") gone("Public event listing expired");
  if (result.status === "unavailable") notFound("Public event not found");
  if (result.status === "not_found") notFound("Public event not found");
  res.json(result.event);
}));

router.get("/public/events/:slug/rsvps", publicRateLimit(60, 60_000), asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) notFound("Public event not found");
  if (event.visibility !== "public") notFound("Public event not found");
  if (event.publicListingStatus === "paused") notFound("Public event not found");
  if (!bbqService.isPublicListingActive(event)) {
    if (event.publicListingExpiresAt && event.publicListingExpiresAt.getTime() <= Date.now()) gone("Public event listing expired");
    notFound("Public event not found");
  }
  const tiers = getPublicRsvpTiersFromTemplateData(event.templateData);
  const rows = await db.select().from(publicEventRsvps).where(eq(publicEventRsvps.barbecueId, event.id));
  const countsByTier: Record<string, { requested: number; approved: number; declined: number; going: number }> = {};
  for (const tier of tiers) countsByTier[tier.id] = { requested: 0, approved: 0, declined: 0, going: 0 };
  for (const row of rows) {
    const tierKey = row.tierId ?? "__default__";
    if (!countsByTier[tierKey]) countsByTier[tierKey] = { requested: 0, approved: 0, declined: 0, going: 0 };
    const status = row.status === "approved" || row.status === "declined" || row.status === "going" ? row.status : "requested";
    countsByTier[tierKey][status] += 1;
  }
  const myRsvp = req.session?.userId
    ? rows.find((r) => r.userId === req.session!.userId) ?? null
    : null;
  res.json({
    tiers: tiers.map((tier) => {
      const counts = countsByTier[tier.id] ?? { requested: 0, approved: 0, declined: 0, going: 0 };
      const filled = counts.approved + counts.going;
      return {
        ...tier,
        counts,
        soldOut: tier.capacity != null ? filled >= tier.capacity : false,
      };
    }),
    myRsvp: myRsvp ? { id: myRsvp.id, tierId: myRsvp.tierId ?? null, status: (myRsvp.status as "requested" | "approved" | "declined" | "going") } : null,
  });
}));

router.post("/public/events/:slug/rsvps", requireAuth, asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const parsed = z.object({
    tierId: z.string().trim().min(1).max(120).nullable().optional(),
    status: z.enum(["requested", "going"]).optional(),
  }).parse(req.body ?? {});
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) notFound("Public event not found");
  if (event.visibility !== "public" || event.publicListingStatus === "paused" || !bbqService.isPublicListingActive(event)) notFound("Public event not found");
  const tiers = getPublicRsvpTiersFromTemplateData(event.templateData);
  if (parsed.tierId && !tiers.some((t) => t.id === parsed.tierId)) badRequest("Invalid tier");
  const targetTier = parsed.tierId ? tiers.find((t) => t.id === parsed.tierId) ?? null : null;
  if (targetTier?.capacity != null) {
    const rows = await db.select().from(publicEventRsvps).where(and(eq(publicEventRsvps.barbecueId, event.id), eq(publicEventRsvps.tierId, targetTier.id)));
    const filled = rows.filter((r) => r.status === "approved" || r.status === "going").length;
    if (filled >= targetTier.capacity) conflict("Tier is sold out");
  }
  const status = event.publicMode === "joinable" ? "requested" : (parsed.status ?? "going");
  const existing = await db.select().from(publicEventRsvps).where(and(eq(publicEventRsvps.barbecueId, event.id), eq(publicEventRsvps.userId, req.session!.userId!)));
  let row;
  if (existing[0]) {
    const [updated] = await db.update(publicEventRsvps)
      .set({ tierId: parsed.tierId ?? null, status, name: req.session!.username ?? null, updatedAt: new Date() })
      .where(eq(publicEventRsvps.id, existing[0].id))
      .returning();
    row = updated;
  } else {
    const [created] = await db.insert(publicEventRsvps).values({
      barbecueId: event.id,
      tierId: parsed.tierId ?? null,
      userId: req.session!.userId!,
      email: null,
      name: req.session!.username ?? null,
      status,
    }).returning();
    row = created;
  }
  res.status(201).json({ id: row.id, tierId: row.tierId, status: row.status });
}));

router.get("/public-events/:eventId/messaging-eligibility", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  const eligibility = await getInboxEligibility(eventId, req.session!.userId!, req.session!.username);
  res.json({
    eventId,
    canMessageOrganizer: eligibility.canMessageOrganizer,
    isOrganizer: eligibility.isOrganizer,
    isApproved: eligibility.isApproved,
    hasJoinRequest: eligibility.hasJoinRequest,
    requestStatus: eligibility.requestStatus,
    reason: eligibility.canMessageOrganizer ? null : (eligibility.bbq.publicMode === "joinable" ? "request_to_join_first" : "invite_only"),
  });
}));

router.post("/public-events/:eventId/conversations", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  const userId = req.session!.userId!;
  const eligibility = await getInboxEligibility(eventId, userId, req.session!.username);
  if (!eligibility.canMessageOrganizer) forbidden("NOT_AUTHORIZED");
  if (eligibility.isOrganizer) {
    badRequest("Organizer cannot create a self conversation");
  }
  const existing = await publicInboxRepo.findConversationForParticipant(eventId, eligibility.organizer.id, userId);
  if (existing) return res.json(existing);
  const created = await publicInboxRepo.createConversation({
    eventId,
    organizerUserId: eligibility.organizer.id,
    participantUserId: userId,
    participantLabel: req.session!.username ?? null,
    status: eligibility.isApproved ? "active" : "pending",
  });
  res.status(201).json(created);
}));

router.get("/events/:eventId/chat", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  const limit = Number(req.query.limit ?? 50);
  await getBarbecueOr404(req, eventId, "Event not found");
  const messages = listEventChatMessages(eventId, limit);
  res.json({ messages, nextCursor: undefined });
}));

router.get("/plans/:id/activity", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, eventId);
  const limit = Number(req.query.limit ?? 10);
  const items = await listPlanActivity(eventId, limit);
  res.json({ items });
}));

router.get("/conversations", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventIdParam = req.query.eventId ? Number(req.query.eventId) : null;
    const rows = await publicInboxRepo.listForUser(req.session!.userId!);
    const filtered = Number.isFinite(eventIdParam as number) ? rows.filter((r) => r.barbecueId === eventIdParam) : rows;
    const grouped: Record<string, typeof filtered> = {};
    for (const row of filtered) {
      const key = String(row.barbecueId);
      grouped[key] = grouped[key] ?? [];
      grouped[key].push(row);
    }
    res.json({ conversations: Array.isArray(filtered) ? filtered : [], groupedByEvent: grouped ?? {} });
  } catch (error) {
    console.error("[/conversations error]", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.session?.userId,
      requestId: (req as any).requestId,
    });
    res.status(200).json({ conversations: [], groupedByEvent: {}, errors: [{ slice: "conversations", code: "SLICE_FAILED" }] });
  }
}));

router.get("/conversations/:conversationId", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId || "").trim();
  if (!conversationId) badRequest("Invalid conversation id");
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  const userId = req.session!.userId!;
  if (convo.organizerUserId !== userId && convo.participantUserId !== userId) forbidden("NOT_AUTHORIZED");
  const messages = await publicInboxRepo.listMessages(conversationId);
  await publicInboxRepo.markConversationRead(conversationId, userId);
  res.json({ conversation: convo, messages });
}));

router.patch("/conversations/:conversationId", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId || "").trim();
  const body = z.object({ status: z.enum(["pending", "active", "archived", "blocked"]) }).parse(req.body ?? {});
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  if (convo.organizerUserId !== req.session!.userId!) forbidden("NOT_AUTHORIZED");
  const updated = await publicInboxRepo.updateConversationStatus(conversationId, body.status);
  res.json(updated);
}));

router.post("/conversations/:conversationId/messages", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId || "").trim();
  if (!conversationId) badRequest("Invalid conversation id");
  const body = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body ?? {});
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  const userId = req.session!.userId!;
  const isOrganizer = convo.organizerUserId === userId;
  const isParticipant = convo.participantUserId === userId;
  if (!isOrganizer && !isParticipant) forbidden("NOT_AUTHORIZED");
  const bbq = await getPublicEventForInboxOrThrow(convo.barbecueId);
  const approvedRsvp = isParticipant && convo.participantUserId
    ? (await db.select().from(publicEventRsvps).where(and(eq(publicEventRsvps.barbecueId, bbq.id), eq(publicEventRsvps.userId, convo.participantUserId))))[0]
    : null;
  const approved = isOrganizer || !!approvedRsvp && (approvedRsvp.status === "approved" || approvedRsvp.status === "going");
  if (convo.status === "blocked") forbidden("Conversation blocked");
  const limit = checkPublicInboxRateLimit({ userId, conversationId, approved });
  if (!limit.ok) {
    res.setHeader("Retry-After", limit.retryAfterSeconds);
    return res.status(429).json({ code: "RATE_LIMITED", message: "Too many messages right now. Please try again later." });
  }
  try {
    console.log("[public-inbox send attempt]", { route: "/conversations/:id/messages", requestId: (req as any).requestId, userId, conversationId, eventId: convo.barbecueId });
    const message = await publicInboxRepo.addMessage({ conversationId, senderUserId: userId, body: body.body });
    if (!approved && convo.status === "pending" && isOrganizer) {
      await publicInboxRepo.updateConversationStatus(conversationId, "active");
    }
    res.status(201).json(message);
  } catch (error) {
    console.error("[public-inbox send failed]", {
      route: "/conversations/:id/messages",
      requestId: (req as any).requestId,
      userId,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}));

router.post("/conversations/:conversationId/read", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId || "").trim();
  if (!conversationId) badRequest("Invalid conversation id");
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  const userId = req.session!.userId!;
  if (convo.organizerUserId !== userId && convo.participantUserId !== userId) forbidden("NOT_AUTHORIZED");
  await publicInboxRepo.markConversationRead(conversationId, userId);
  res.json({ ok: true });
}));

router.get("/events/:id/rsvp-requests", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can view RSVP requests");
  const rows = await db.select().from(publicEventRsvps).where(eq(publicEventRsvps.barbecueId, id));
  res.json(rows);
}));

router.patch("/events/:id/rsvp-requests/:rsvpId", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const rsvpId = Number(req.params.rsvpId);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can manage RSVP requests");
  const body = z.object({ status: z.enum(["approved", "declined", "going", "requested"]) }).parse(req.body ?? {});
  const [updated] = await db.update(publicEventRsvps)
    .set({ status: body.status, updatedAt: new Date() })
    .where(and(eq(publicEventRsvps.id, rsvpId), eq(publicEventRsvps.barbecueId, id)))
    .returning();
  if (!updated) notFound("RSVP not found");
  res.json(updated);
}));

router.get("/share/event/:id.svg", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.visibility !== "public" || !bbq.publicSlug || !bbqService.isPublicListingActive(bbq)) notFound("Public event not found");
  const title = (bbq.name || "Public event").slice(0, 80).replace(/[<>&]/g, "");
  const subtitle = `${[bbq.city, bbq.countryName].filter(Boolean).join(", ") || "Location TBA"} · ${bbq.date ? bbq.date.toISOString().slice(0, 10) : "Date TBA"}`.replace(/[<>&]/g, "");
  const organizer = (bbq.organizationName || bbq.creatorId || "Splanno").slice(0, 60).replace(/[<>&]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#101828"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="40" y="40" width="1120" height="550" rx="28" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)"/>
  <text x="80" y="130" fill="rgba(255,255,255,0.82)" font-size="28" font-family="Inter, Arial, sans-serif">Splanno · Public Event</text>
  <text x="80" y="245" fill="#ffffff" font-size="64" font-weight="700" font-family="Inter, Arial, sans-serif">${title}</text>
  <text x="80" y="305" fill="rgba(255,255,255,0.75)" font-size="28" font-family="Inter, Arial, sans-serif">${subtitle}</text>
  <text x="80" y="540" fill="rgba(255,255,255,0.85)" font-size="24" font-family="Inter, Arial, sans-serif">Hosted by ${organizer}</text>
</svg>`;
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(svg);
}));

router.get(p(api.barbecues.get.path), asyncHandler(async (req, res) => {
  const bbq = await bbqService.getBarbecueIfAccessible(Number(req.params.id), req.session?.userId, req.session?.username);
  if (!bbq) notFound("BBQ not found");
  res.json(bbq);
}));

/** Resolve invite token to event info (public, for /join/:token page). */
router.get("/join/:token", asyncHandler(async (req, res) => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const bbq = await bbqRepo.getByInviteToken(token);
  if (!bbq) notFound("Invite not found");
  res.json({
    bbqId: bbq.id,
    name: bbq.name,
    eventType: bbq.eventType,
    currency: bbq.currency,
  });
}));

router.get("/invites/:token", asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? "").trim();
  if (!token) badRequest("Invalid invite token");
  const rows = await db.select().from(eventInvites).where(eq(eventInvites.token, token)).limit(1);
  const invite = rows[0];
  if (!invite) notFound("Invite not found");
  if (invite.status !== "pending") gone("Invite no longer active");
  if (invite.expiresAt.getTime() <= Date.now()) gone("Invite expired");
  const bbq = await bbqRepo.getById(invite.eventId);
  if (!bbq) notFound("Event not found");
  res.json({
    inviteId: invite.id,
    eventId: bbq.id,
    name: bbq.name,
    eventType: bbq.eventType,
    currency: bbq.currency,
    email: invite.email ?? null,
    status: invite.status,
  });
}));

router.post("/invites/:token/accept", requireAuth, asyncHandler(async (req, res) => {
  try {
    const token = String(req.params.token ?? "").trim();
    if (!token) badRequest("Invalid invite token");
    const userId = req.session!.userId!;
    const username = req.session!.username!;
    const rows = await db.select().from(eventInvites).where(eq(eventInvites.token, token)).limit(1);
    const invite = rows[0];
    if (!invite) notFound("Invite not found");
    if (invite.status !== "pending") conflict("Invite already handled");
    if (invite.expiresAt.getTime() <= Date.now()) gone("Invite expired");

    const eventId = invite.eventId;
    const now = new Date();
    const [member] = await db.insert(eventMembers).values({
      eventId,
      userId,
      role: "member",
      joinedAt: now,
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] }).returning();
    if (!member) {
      const existing = await db.select().from(eventMembers).where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId))).limit(1);
      if (!existing[0]) conflict("Could not join event");
    }

    const existingParticipant = await db
      .select()
      .from(participants)
      .where(and(eq(participants.barbecueId, eventId), eq(participants.status, "accepted"), or(eq(participants.invitedUserId, userId), eq(participants.userId, username))))
      .limit(1);
    if (!existingParticipant[0]) {
      await participantRepo.create({
        barbecueId: eventId,
        name: username,
        userId: username,
        invitedUserId: userId,
        status: "accepted",
      });
    }

    await db.update(eventInvites).set({
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: now,
    }).where(eq(eventInvites.id, invite.id));

    const me = await userRepo.findById(userId);
    broadcastEventRealtime(eventId, {
      type: "event:member_joined",
      eventId,
      member: {
        userId: Number(userId),
        name: me?.displayName || me?.username || username,
        avatarUrl: me?.avatarUrl ?? null,
        role: "member",
        joinedAt: now.toISOString(),
      },
    });
    broadcastEventRealtime(eventId, {
      type: "chat:system",
      eventId: Number(eventId),
      text: `${me?.displayName || me?.username || username} joined the event`,
    });
    await logPlanActivity({
      eventId,
      type: "MEMBER_JOINED",
      actorUserId: userId,
      actorName: me?.displayName || me?.username || username,
      message: `${me?.displayName || me?.username || username} joined the plan`,
      meta: { userId },
    });

    res.json({ eventId: Number(eventId) });
  } catch (err) {
    return handleGuestRouteError("POST /api/invites/:token/accept", req, err, res);
  }
}));

router.get("/events/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    const rows = await db
      .select({
        userId: eventMembers.userId,
        role: eventMembers.role,
        joinedAt: eventMembers.joinedAt,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        profileImageUrl: users.profileImageUrl,
      })
      .from(eventMembers)
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .where(eq(eventMembers.eventId, eventId))
      .orderBy(desc(eventMembers.joinedAt));
    res.json(rows.map((r) => ({
      userId: Number(r.userId),
      name: r.displayName || r.username,
      username: r.username,
      avatarUrl: r.avatarUrl ?? r.profileImageUrl ?? null,
      role: r.role,
      joinedAt: r.joinedAt ? r.joinedAt.toISOString() : null,
    })));
  } catch (err) {
    return handleGuestRouteError("GET /api/events/:eventId/members", req, err, res);
  }
}));

router.post("/events/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);

    const parsed = z.object({ userId: z.coerce.number().int().positive() }).parse(req.body ?? {});
    const targetUser = await userRepo.findById(parsed.userId);
    if (!targetUser) notFound("User not found");

    const now = new Date();
    const inserted = await db.insert(eventMembers).values({
      eventId,
      userId: targetUser.id,
      role: "member",
      joinedAt: now,
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] }).returning();

    await db.insert(participants).values({
      barbecueId: eventId,
      name: targetUser.displayName || targetUser.username,
      userId: targetUser.username,
      invitedUserId: targetUser.id,
      status: "accepted",
    }).onConflictDoNothing();

    const memberPayload = {
      userId: Number(targetUser.id),
      name: targetUser.displayName || targetUser.username,
      username: targetUser.username,
      avatarUrl: targetUser.avatarUrl ?? targetUser.profileImageUrl ?? null,
      role: (inserted[0]?.role ?? "member") as "member" | "owner",
      joinedAt: (inserted[0]?.joinedAt ?? now).toISOString(),
    };
    if (inserted[0]) {
      broadcastEventRealtime(eventId, {
        type: "event:member_joined",
        eventId: Number(eventId),
        member: memberPayload,
      });
      broadcastEventRealtime(eventId, {
        type: "chat:system",
        eventId: Number(eventId),
        text: `${memberPayload.name} joined the event`,
      });
    }

    res.status(200).json(memberPayload);
  } catch (err) {
    return handleGuestRouteError("POST /api/events/:eventId/members", req, err, res);
  }
}));

router.get("/events/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    const status = String(req.query.status ?? "pending");
    const rows = await db.select().from(eventInvites)
      .where(and(eq(eventInvites.eventId, eventId), eq(eventInvites.status, status)))
      .orderBy(desc(eventInvites.createdAt));
    const appOrigin = getAppOrigin(req);
    res.json(rows.map((row) => ({
      id: row.id,
      email: row.email,
      token: row.token,
      inviteUrl: `${appOrigin}/invite/${row.token}`,
      status: row.status,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      expiresAt: row.expiresAt.toISOString(),
    })));
  } catch (err) {
    return handleGuestRouteError("GET /api/events/:eventId/invites", req, err, res);
  }
}));

router.post("/events/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);

    const parsed = z.object({ email: z.string().email().optional() }).parse(req.body ?? {});
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [invite] = await db.insert(eventInvites).values({
      eventId,
      inviterUserId: req.session!.userId!,
      email: parsed.email ?? null,
      token,
      status: "pending",
      expiresAt,
    }).returning();

    const appOrigin = getAppOrigin(req);
    const inviteUrl = `${appOrigin}/invite/${token}`;
    if (parsed.email) {
      console.log("[event-invite] email invite placeholder", { eventId, email: parsed.email, inviteUrl });
    }

    broadcastEventRealtime(eventId, {
      type: "event:invite_created",
      eventId: Number(eventId),
      invite: {
        id: invite.id,
        email: invite.email,
        status: invite.status,
        createdAt: invite.createdAt ? invite.createdAt.toISOString() : null,
        expiresAt: invite.expiresAt.toISOString(),
        token: invite.token,
        inviteUrl,
      },
    });

    res.status(201).json({
      inviteId: invite.id,
      token,
      inviteUrl,
    });
  } catch (err) {
    return handleGuestRouteError("POST /api/events/:eventId/invites", req, err, res);
  }
}));

router.post("/events/:eventId/invites/:inviteId/revoke", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const inviteId = String(req.params.inviteId ?? "").trim();
  if (!inviteId) badRequest("Invalid invite id");

  const existing = await db
    .select()
    .from(eventInvites)
    .where(and(eq(eventInvites.id, inviteId), eq(eventInvites.eventId, eventId)))
    .limit(1);
  if (!existing[0]) notFound("Invite not found");
  if (existing[0].status !== "pending") conflict("Invite can no longer be revoked");

  const [updated] = await db
    .update(eventInvites)
    .set({ status: "revoked" })
    .where(eq(eventInvites.id, inviteId))
    .returning();

  broadcastEventRealtime(eventId, {
    type: "event:invite_revoked",
    eventId,
    inviteId,
  });

  res.json({
    id: updated.id,
    status: updated.status,
  });
}));

/** Ensure event has invite token (backfill for legacy events). Creator only. */
router.post("/barbecues/:id/ensure-invite-token", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  await assertEventAccessOrThrow(req, id);
  const updated = await bbqRepo.ensureInviteToken(id);
  if (!updated) notFound("Event not found");
  res.json(updated);
}));

router.delete(p(api.barbecues.delete.path), asyncHandler(async (req, res) => {
  await bbqRepo.delete(Number(req.params.id));
  res.status(204).send();
}));

router.patch(p(api.barbecues.update.path), requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("BBQ not found");
  await assertEventAccessOrThrow(req, id);
  const schema = z.object({
    name: z.string().min(1).max(120).optional(),
    date: z.coerce.date().optional(),
    allowOptInExpenses: z.boolean().optional(),
    templateData: z.unknown().optional(),
    status: z.enum(["draft", "active", "settling", "settled"]).optional(),
    locationName: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    countryCode: optionalCountryCodeSchema.nullable().optional(),
    countryName: z.string().nullable().optional(),
    latitude: z.coerce.number().finite().nullable().optional(),
    longitude: z.coerce.number().finite().nullable().optional(),
    placeId: z.string().nullable().optional(),
    locationText: z.string().nullable().optional(),
    locationMeta: z.unknown().nullable().optional(),
    currency: z.string().length(3).transform((s) => s.toUpperCase()).optional(),
    currencySource: z.enum(["auto", "manual"]).optional(),
    eventType: z.string().optional(),
    eventVibe: z.string().optional(),
    visibility: visibilitySchema.optional(),
    visibilityOrigin: visibilityOriginSchema.optional(),
    publicMode: publicModeSchema.optional(),
    publicTemplate: publicTemplateSchema.optional(),
    publicListingStatus: listingStatusSchema.optional(),
    publicListFromAt: z.coerce.date().nullable().optional(),
    publicListUntilAt: z.coerce.date().nullable().optional(),
    publicListingExpiresAt: z.coerce.date().nullable().optional(),
    organizationName: z.string().max(160).nullable().optional(),
    publicDescription: z.string().max(5000).nullable().optional(),
    bannerImageUrl: z.string().url().nullable().optional(),
  });
  const body = schema.parse(req.body);
  const updated = await bbqService.updateBarbecue(id, body, req.session!.username, req.session!.userId);
  if (!updated) notFound("BBQ not found");
  await logPlanActivity({
    eventId: id,
    type: "PLAN_UPDATED",
    actorUserId: req.session?.userId ?? null,
    actorName: req.session?.username ?? "Someone",
    message: `${req.session?.username ?? "Someone"} updated the plan`,
    meta: {
      changedFields: Object.keys(body),
    },
  });
  res.json(updated);
}));

router.post("/events/:id/activate-listing", requireAuth, asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    notFound("Not found");
  }
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  const username = req.session!.username;
  const ownerOrAdmin = bbq.creatorId === username || isAdmin(req);
  if (!ownerOrAdmin) forbidden("Only the creator can activate listing");

  let updated: Awaited<ReturnType<typeof bbqService.activateListing>> | undefined;
  if (bbq.creatorId === username) {
    updated = await bbqService.activateListing(id, username);
  } else {
    const base = await bbqRepo.update(id, {
      publicListingStatus: "active",
      publicListingExpiresAt: new Date(Date.now() + Number(process.env.PUBLIC_LISTING_DAYS ?? 30) * 24 * 60 * 60 * 1000),
    });
    updated = base ? await bbqService.ensurePublicSlug(base) ?? base : undefined;
  }
  if (!updated) notFound("Event not found");
  res.json({
    id: updated.id,
    visibility: updated.visibility,
    publicMode: updated.publicMode,
    publicListingStatus: updated.publicListingStatus,
    publicListingExpiresAt: updated.publicListingExpiresAt,
    publicSlug: updated.publicSlug,
  });
}));

router.post("/events/:id/checkout-public-listing", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can activate listing");
  const body = z.object({ publicMode: publicModeSchema.optional() }).parse(req.body ?? {});

  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  const priceId = process.env.STRIPE_PRICE_PUBLIC_LISTING?.trim();
  if (!appUrl) badRequest("APP_URL is not configured");
  if (!priceId) badRequest("STRIPE_PRICE_PUBLIC_LISTING is not configured");
  const checkoutPublicMode = body.publicMode ?? (bbq.publicMode as "marketing" | "joinable" | undefined) ?? "marketing";

  const session = await createStripeCheckoutSession({
    priceId,
    successUrl: `${appUrl}/app?listing=success&eventId=${id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/app?listing=cancel&eventId=${id}`,
    idempotencyKey: `public-listing:${id}:${req.session!.userId ?? req.session!.username}:${checkoutPublicMode}`,
    metadata: {
      eventId: String(id),
      userId: String(req.session!.userId),
      action: "activate_public_listing",
      intendedAction: "activate_public_listing",
      publishAfterActivation: "true",
      publicMode: checkoutPublicMode,
    },
  });

  if (!session.url) badRequest("Stripe checkout session did not return a URL");
  res.json({ url: session.url });
}));

router.post("/events/:id/deactivate-listing", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  const username = req.session!.username;
  const ownerOrAdmin = bbq.creatorId === username || isAdmin(req);
  if (!ownerOrAdmin) forbidden("Only the creator can deactivate listing");
  const updated = await bbqRepo.update(id, {
    publicListingStatus: "inactive",
    visibility: "private",
  });
  if (!updated) notFound("Event not found");
  res.json(updated);
}));

router.post("/stripe/webhook", asyncHandler(async (req, res) => {
  const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
  if (!Buffer.isBuffer(rawBody)) badRequest("Missing raw webhook body");
  const event = verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"] as string | undefined) as {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  const eventId = String(event.id ?? "").trim();
  const eventType = String(event.type ?? "").trim();
  if (!eventId || !eventType) badRequest("Invalid Stripe event payload");

  const existingProcessed = await db.select().from(stripeEvents).where(eq(stripeEvents.id, eventId));
  if (existingProcessed.length > 0) {
    res.json({ received: true, duplicate: true });
    return;
  }

  if (eventType === "checkout.session.completed") {
    const object = (event.data?.object ?? {}) as {
      metadata?: Record<string, string | undefined>;
      payment_status?: string;
    };
    const metadata = object.metadata ?? {};
    const action = metadata.action ?? metadata.intendedAction;
    if (action === "activate_public_listing" && metadata.eventId) {
      const eventIdNum = Number(metadata.eventId);
      if (Number.isFinite(eventIdNum)) {
        const publishAfterActivation = metadata.publishAfterActivation === "true";
        const publicMode = metadata.publicMode === "joinable" ? "joinable" : metadata.publicMode === "marketing" ? "marketing" : undefined;
        await bbqService.activateListingBySystem(eventIdNum, {
          publishAfterActivation,
          publicMode,
        });
      }
    }
  }

  await db.insert(stripeEvents).values({ id: eventId }).onConflictDoNothing({ target: stripeEvents.id });
  res.json({ received: true });
}));

/** Settle up: creator triggers settling, notifies participants. */
router.post("/barbecues/:id/settle-up", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can settle up");
  const participantsList = await participantRepo.listByBbq(id, "accepted");
  const expensesList = await expenseRepo.listByBbq(id);
  const total = expensesList.reduce((s, e) => s + parseFloat(String(e.amount || 0)), 0);
  const n = participantsList.length;
  const fairShare = n > 0 ? total / n : 0;
  const paidBy: Record<number, number> = {};
  participantsList.forEach((p) => (paidBy[p.id] = 0));
  expensesList.forEach((e) => {
    if (paidBy[e.participantId] !== undefined) paidBy[e.participantId] += parseFloat(String(e.amount || 0));
  });
  const creatorName = bbq.creatorId || "Someone";
  const notifications: { userId: string; barbecueId: number; type: string; payload: { creatorName: string; amountOwed: number; eventName: string; currency: string } }[] = [];
  for (const p of participantsList) {
    if (!p.userId || p.userId === bbq.creatorId) continue;
    const balance = (paidBy[p.id] ?? 0) - fairShare;
    if (balance < -0.01) {
      notifications.push({
        userId: p.userId,
        barbecueId: id,
        type: "event_settled_started",
        payload: {
          creatorName,
          amountOwed: Math.abs(balance),
          eventName: bbq.name,
          currency: bbq.currency ?? "EUR",
        },
      });
    }
  }
  await bbqRepo.createEventNotificationsBatch(notifications);
  const now = new Date();
  const settleSnapshot = { total, expenseCount: expensesList.length, at: now.toISOString() };
  const currentTemplate = (bbq.templateData as Record<string, unknown>) || {};
  const updated = await bbqRepo.update(id, {
    status: "settling",
    settledAt: now,
    templateData: { ...currentTemplate, settleSnapshot },
  });
  if (!updated) notFound("Event not found");
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || (req.socket as { remoteAddress?: string }).remoteAddress || "unknown";
  auditSecurity("event.lock", { user: req.session!.userId, ip });
  auditLog("barbecue.settle_up", { barbecueId: id, username: req.session!.username });
  res.json(updated);
}));

// Notifications
router.get("/notifications/events", requireAuth, asyncHandler(async (req, res) => {
  const username = req.session!.username;
  if (!username) return res.json([]);
  const items = await bbqRepo.getEventNotificationsForUser(username);
  res.json(items);
}));

router.patch("/notifications/events/:id/read", requireAuth, asyncHandler(async (req, res) => {
  await bbqRepo.markEventNotificationRead(Number(req.params.id));
  res.status(204).send();
}));

// Participants
router.get(p(api.participants.list.path), asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await participantRepo.listByBbq(bbq.id, "accepted");
  res.json(items);
}));

router.get(p(api.participants.pending.path), asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await participantRepo.listByBbq(bbq.id, "pending");
  res.json(items);
}));

router.get("/barbecues/:bbqId/invited", asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await participantRepo.listByBbq(bbq.id, "invited");
  res.json(items);
}));

router.post(p(api.participants.create.path), asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const bbq = await getBarbecueOr404(req, bbqId);
  const creatorUser = bbq.creatorId ? await userRepo.findByUsername(bbq.creatorId) : undefined;
  const limits = getLimits(creatorUser ?? undefined);
  const participantCount = await participantRepo.countByBbq(bbqId);
  if (participantCount >= limits.maxParticipantsPerEvent) {
    upgradeRequired("more_participants", { current: participantCount, max: limits.maxParticipantsPerEvent });
  }
  const input = api.participants.create.input.parse(req.body);
  const created = await participantRepo.create({
    ...input,
    barbecueId: bbqId,
    status: "accepted",
  });
  if (created.userId) {
    const user = await userRepo.findByUsername(created.userId);
    if (user) {
      await db.insert(eventMembers).values({
        eventId: bbqId,
        userId: user.id,
        role: "member",
        joinedAt: new Date(),
      }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
      broadcastEventRealtime(bbqId, {
        type: "event:member_joined",
        eventId: bbqId,
        member: {
          userId: user.id,
          name: user.displayName || user.username,
          avatarUrl: user.avatarUrl ?? null,
          role: "member",
          joinedAt: new Date().toISOString(),
        },
      });
    }
  }
  res.status(201).json(created);
}));

router.post(p(api.participants.join.path), asyncHandler(async (req, res) => {
  const input = api.participants.join.input.parse(req.body);
  const bbqId = Number(req.params.bbqId);
  const bbq = await getBarbecueOr404(req, bbqId);
  const creatorUser = bbq.creatorId ? await userRepo.findByUsername(bbq.creatorId) : undefined;
  const limits = getLimits(creatorUser ?? undefined);
  const participantCount = await participantRepo.countByBbq(bbqId);
  if (participantCount >= limits.maxParticipantsPerEvent) {
    upgradeRequired("more_participants", { current: participantCount, max: limits.maxParticipantsPerEvent });
  }
  const existing = await participantRepo.getMemberships(input.userId);
  const alreadyIn = existing.find((m) => m.bbqId === bbqId);
  if (alreadyIn) {
    conflict(alreadyIn.status === "accepted" ? "already_joined" : "already_pending");
  }
  const created = await participantRepo.joinBarbecue(bbqId, input.name, input.userId);
  res.status(201).json(created);
}));

router.post("/barbecues/:bbqId/invite", requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({ username: z.string().min(1) });
  const { username } = schema.parse(req.body);
  const bbqId = Number(req.params.bbqId);
  await assertEventAccessOrThrow(req, bbqId);
  const targetUser = await userRepo.findByUsername(username.trim());
  if (!targetUser) notFound("User not found");
  const existing = await db.select().from(participants).where(
    and(
      eq(participants.barbecueId, bbqId),
      or(eq(participants.invitedUserId, targetUser.id), eq(participants.userId, targetUser.username)),
    ),
  );
  if (existing[0]) conflict("already_member");
  const created = await participantRepo.inviteUser(bbqId, targetUser.username, targetUser.id);
  res.status(201).json(created);
}));

router.patch(p(api.participants.accept.path), asyncHandler(async (req, res) => {
  const updated = await participantRepo.accept(Number(req.params.id));
  if (!updated) notFound("Participant not found");
  const user = updated.invitedUserId ? await userRepo.findById(updated.invitedUserId) : null;
  if (updated.invitedUserId) {
    await db.insert(eventMembers).values({
      eventId: updated.barbecueId,
      userId: updated.invitedUserId,
      role: "member",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    broadcastEventRealtime(updated.barbecueId, {
      type: "event:member_joined",
      eventId: updated.barbecueId,
      member: {
        userId: updated.invitedUserId,
        name: user?.displayName || user?.username || updated.name,
        avatarUrl: user?.avatarUrl ?? null,
        role: "member",
        joinedAt: new Date().toISOString(),
      },
    });
  }
  res.json(updated);
}));

router.patch(p(api.participants.update.path), asyncHandler(async (req, res) => {
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  const id = Number(req.params.id);
  const input = api.participants.update.input.parse(req.body);
  const participant = await participantRepo.getById(id);
  if (!participant) notFound("Participant not found");
  if (participant.userId !== username) forbidden("Can only edit your own name");
  const updated = await participantRepo.updateName(id, input.name);
  if (!updated) notFound("Participant not found");
  res.json(updated);
}));

router.delete(p(api.participants.delete.path), asyncHandler(async (req, res) => {
  await participantRepo.delete(Number(req.params.id));
  res.status(204).send();
}));

// Memberships
router.get(p(api.memberships.list.path), asyncHandler(async (req, res) => {
  const userId = (req.query.userId as string | undefined) || req.session?.username;
  if (!userId) return res.json([]);
  const memberships = await participantRepo.getMemberships(userId);
  res.json(memberships);
}));

// Expenses
router.get(p(api.expenses.list.path), asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await expenseRepo.listByBbq(bbq.id);
  res.json(items);
}));

router.post(p(api.expenses.create.path), asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const bbq = await getBarbecueOr404(req, bbqId);
  const bodySchema = api.expenses.create.input.extend({
    amount: z.coerce.number(),
    participantId: z.coerce.number(),
  });
  const input = bodySchema.parse(req.body);
  const { optInByDefault, ...expenseData } = input;
  const created = await expenseRepo.create({ ...expenseData, barbecueId: bbqId }, { optInByDefault });
  const actor = await participantRepo.getById(input.participantId);
  const actorName = actor?.name || req.session?.username || "Someone";
  await logPlanActivity({
    eventId: bbqId,
    type: "EXPENSE_ADDED",
    actorUserId: req.session?.userId ?? null,
    actorName,
    message: `${actorName} added an expense: ${created.item} (${bbq.currency ?? "€"}${Number(created.amount).toFixed(2)})`,
    meta: {
      expenseId: created.id,
      amount: Number(created.amount),
      currency: bbq.currency ?? null,
    },
  });
  res.status(201).json(created);
}));

router.put(p(api.expenses.update.path), asyncHandler(async (req, res) => {
  const bodySchema = api.expenses.update.input.extend({
    amount: z.coerce.number().optional(),
    participantId: z.coerce.number().optional(),
  });
  const input = bodySchema.parse(req.body);
  const updated = await expenseRepo.update(Number(req.params.id), input);
  if (!updated) notFound("Expense not found");
  res.json(updated);
}));

router.delete(p(api.expenses.delete.path), asyncHandler(async (req, res) => {
  await expenseRepo.delete(Number(req.params.id));
  res.status(204).send();
}));

router.post("/expenses/:expenseId/receipt", requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);

  const payload = z.object({
    dataUrl: z.string().min(1),
  }).parse(req.body ?? {});

  const match = payload.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid receipt image");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
  if (!allowedMime.has(mime)) badRequest("Unsupported image type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid image payload");
  if (buffer.length > MAX_RECEIPT_SIZE_BYTES) badRequest("Receipt image must be 5MB or smaller");

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extensionByMime[mime] ?? "jpg";
  const fileName = `expense-${expenseId}-${randomUUID()}.${ext}`;
  await fs.mkdir(RECEIPT_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(RECEIPT_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  const prevReceiptUrl = expense.receiptUrl ?? null;
  const receiptUrl = `/uploads/receipts/${fileName}`;
  const updated = await expenseRepo.update(expenseId, {
    receiptUrl,
    receiptMime: mime,
    receiptUploadedAt: new Date(),
  });
  if (!updated) notFound("Expense not found");

  if (prevReceiptUrl?.startsWith("/uploads/receipts/")) {
    const oldPath = path.join(RECEIPT_UPLOAD_DIR, path.basename(prevReceiptUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  res.json({
    expenseId,
    receiptUrl: updated.receiptUrl ?? null,
    receiptMime: updated.receiptMime ?? null,
    receiptUploadedAt: updated.receiptUploadedAt ?? null,
  });
}));

router.delete("/expenses/:expenseId/receipt", requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);

  if (expense.receiptUrl?.startsWith("/uploads/receipts/")) {
    const oldPath = path.join(RECEIPT_UPLOAD_DIR, path.basename(expense.receiptUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  const updated = await expenseRepo.update(expenseId, {
    receiptUrl: null,
    receiptMime: null,
    receiptUploadedAt: null,
  });
  if (!updated) notFound("Expense not found");
  res.json({ expenseId, receiptUrl: null });
}));

router.post("/barbecues/:bbqId/banner", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  if (!Number.isFinite(bbqId)) badRequest("Invalid event id");
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibilityOrigin !== "private") forbidden("Banner editing via this action is available for private events only");
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  if (!isAdmin(req)) {
    await assertEventAccessOrThrow(req, bbqId);
  }

  const payload = z.object({ dataUrl: z.string().min(1) }).parse(req.body ?? {});
  const match = payload.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid banner image");

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  if (!allowedMime.has(mime)) badRequest("Unsupported image type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid image payload");
  if (buffer.length > MAX_EVENT_BANNER_SIZE_BYTES) badRequest("Banner image must be 5MB or smaller");

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extensionByMime[mime] ?? "jpg";
  const fileName = `event-${bbqId}-${randomUUID()}.${ext}`;
  await fs.mkdir(EVENT_BANNER_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(EVENT_BANNER_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  const prevBannerUrl = bbq.bannerImageUrl ?? null;
  const bannerImageUrl = `/uploads/event-banners/${fileName}`;
  const updated = await bbqRepo.update(bbqId, { bannerImageUrl });
  if (!updated) notFound("Event not found");

  if (prevBannerUrl?.startsWith("/uploads/event-banners/")) {
    const oldPath = path.join(EVENT_BANNER_UPLOAD_DIR, path.basename(prevBannerUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  res.json({
    bbqId,
    bannerImageUrl: updated.bannerImageUrl ?? null,
  });
}));

router.delete("/barbecues/:bbqId/banner", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  if (!Number.isFinite(bbqId)) badRequest("Invalid event id");
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibilityOrigin !== "private") forbidden("Banner editing via this action is available for private events only");
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  if (!isAdmin(req)) {
    await assertEventAccessOrThrow(req, bbqId);
  }

  if (bbq.bannerImageUrl?.startsWith("/uploads/event-banners/")) {
    const oldPath = path.join(EVENT_BANNER_UPLOAD_DIR, path.basename(bbq.bannerImageUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  const updated = await bbqRepo.update(bbqId, { bannerImageUrl: null });
  if (!updated) notFound("Event not found");
  res.json({ bbqId, bannerImageUrl: null });
}));

router.get("/barbecues/:bbqId/expense-shares", asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const shares = await expenseRepo.getExpenseShares(bbq.id);
  res.json(shares);
}));

// Notes (event-agnostic: eventId = barbecue id for parties/trips)
router.get(p(api.notes.list.path), asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const bbq = await getBarbecueOr404(req, eventId);
  const items = await expenseRepo.getNotes(bbq.id);
  res.json(items);
}));

router.post(p(api.notes.create.path), asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const bbq = await getBarbecueOr404(req, eventId);
  const input = api.notes.create.input.parse(req.body);
  const participant = await participantRepo.getById(input.participantId);
  if (!participant || participant.barbecueId !== eventId) {
    forbidden("Invalid participant for this event");
  }
  const created = await expenseRepo.createNote({
    barbecueId: eventId,
    participantId: input.participantId,
    title: input.title ?? null,
    body: input.body,
    pinned: input.pinned ?? false,
  });
  res.status(201).json(created);
}));

router.patch(p(api.notes.update.path), asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const input = api.notes.update.input.parse(req.body);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  const username = req.session?.username;
  if (username && participant?.userId && participant.userId !== username) {
    forbidden("Can only edit your own notes");
  }
  const updated = await expenseRepo.updateNote(noteId, input);
  if (!updated) notFound("Note not found");
  res.json(updated);
}));

router.delete(p(api.notes.delete.path), asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  const username = req.session?.username;
  if (username && participant?.userId && participant.userId !== username) {
    forbidden("Can only delete your own notes");
  }
  await expenseRepo.deleteNote(noteId);
  res.status(204).send();
}));

router.patch("/barbecues/:bbqId/expenses/:expenseId/share", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const expenseId = Number(req.params.expenseId);
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) notFound("BBQ not found");
  if (bbq.visibility !== "private") badRequest("Opt-in expenses are only available for private events");
  if (!bbq.allowOptInExpenses) badRequest("Opt-in expenses not enabled for this BBQ");
  const participantsList = await participantRepo.listByBbq(bbqId, "accepted");
  const myParticipant = participantsList.find((p) => p.userId === req.session!.username);
  if (!myParticipant) forbidden("Not a participant of this BBQ");
  const [expenseRow] = await db.select().from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.barbecueId, bbqId)));
  if (!expenseRow) notFound("Expense not found");
  const schema = z.object({ in: z.boolean() });
  const { in: inShare } = schema.parse(req.body);
  await expenseRepo.setExpenseShare(expenseId, myParticipant.id, inShare);
  res.json({ ok: true });
}));

// Friends
router.get("/friends", requireAuth, asyncHandler(async (req, res) => {
  const friends = await participantRepo.getFriends(req.session!.userId!);
  res.json(friends);
}));

router.get("/friends/requests", requireAuth, asyncHandler(async (req, res) => {
  const requests = await participantRepo.getFriendRequests(req.session!.userId!);
  res.json(requests);
}));

router.get("/friends/sent", requireAuth, asyncHandler(async (req, res) => {
  const sent = await participantRepo.getSentFriendRequests(req.session!.userId!);
  res.json(sent);
}));

router.post("/friends/request", requireAuth, asyncHandler(async (req, res) => {
  const { username } = z.object({ username: z.string() }).parse(req.body);
  const target = await userRepo.findByUsername(username);
  if (!target) notFound("user_not_found");
  if (target.id === req.session!.userId) badRequest("cannot_friend_self");
  try {
    await participantRepo.sendFriendRequest(req.session!.userId!, target.id);
  } catch (err) {
    if (err instanceof Error && err.message === "friendship_exists") conflict("friendship_exists");
    throw err;
  }
  res.status(201).json({ ok: true });
}));

router.patch("/friends/:id/accept", requireAuth, asyncHandler(async (req, res) => {
  await participantRepo.acceptFriendRequest(Number(req.params.id));
  res.json({ ok: true });
}));

router.delete("/friends/:id", requireAuth, asyncHandler(async (req, res) => {
  await participantRepo.removeFriend(Number(req.params.id));
  res.status(204).send();
}));

// All pending requests across creator's BBQs
router.get("/pending-requests/all", requireAuth, asyncHandler(async (req, res) => {
  const username = req.session!.username;
  if (!username) return res.json([]);
  const all = await participantRepo.getAllPendingRequestsForCreator(username);
  res.json(all);
}));

// Search users (for adding friends) - must be before /:username
router.get("/users/search", requireAuth, asyncHandler(async (req, res) => {
  const reqId = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  const userId = req.session?.userId;
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const throttleKey = `${userId ?? "anon"}:${ip}`;
  const now = Date.now();
  const current = usersSearchRate.get(throttleKey);
  if (!current || now - current.windowStart > USERS_SEARCH_WINDOW_MS) {
    usersSearchRate.set(throttleKey, { count: 1, windowStart: now });
  } else {
    current.count += 1;
    if (current.count > USERS_SEARCH_MAX_REQUESTS) {
      return res.status(429).json({ code: "USERS_SEARCH_RATE_LIMITED", message: "Too many search requests. Try again shortly." });
    }
  }

  try {
    const rawInput = typeof req.query.q === "string" ? req.query.q : "";
    const trimmed = rawInput.trim().slice(0, 50);
    if (trimmed.length < 2) return res.json({ users: [] });
    if (!userId) return res.status(401).json({ code: "UNAUTHORIZED", message: "Not authenticated" });

    const escaped = escapeLikeQuery(trimmed);
    const pattern = `%${escaped}%`;
    const limit = 10;

    const results = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(and(
        sql`${users.id} <> ${userId}`,
        or(
          sql`${users.username} ILIKE ${pattern} ESCAPE '\\'`,
          sql`COALESCE(${users.displayName}, '') ILIKE ${pattern} ESCAPE '\\'`,
          sql`COALESCE(${users.email}, '') ILIKE ${pattern} ESCAPE '\\'`,
        ),
      ))
      .limit(limit);

    return res.json({
      users: results.map((u) => ({
        id: Number(u.id),
        displayName: u.displayName || u.username,
        handle: u.username,
        avatarUrl: u.avatarUrl ?? u.profileImageUrl ?? null,
      })),
    });
  } catch (err) {
    log("error", "users-search failed", {
      route: "GET /api/users/search",
      reqId,
      message: err instanceof Error ? err.message : "unknown_error",
    });
    return res.status(500).json({
      code: "USERS_SEARCH_FAILED",
      message: process.env.NODE_ENV === "development" && err instanceof Error ? err.message : "Couldn’t search users right now.",
    });
  }
}));

// Public profile by username (for viewing other users)
router.get("/users/:username", requireAuth, asyncHandler(async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  if (!username) badRequest("Username required");
  const profile = await userRepo.getPublicProfileWithStats(username);
  if (!profile) notFound("User not found");
  res.json(profile);
}));

// Shareable public profile page payload (privacy-safe, no auth required)
router.get("/public-profile/:username", asyncHandler(async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  if (!username) badRequest("Username required");
  const viewerUsername = req.session?.username;
  const profile = await userRepo.getShareablePublicProfile(username, viewerUsername);
  if (!profile) notFound("Profile not found");
  res.json(profile);
}));

export default router;
