import { Router, type Request } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { api } from "@shared/routes";
import { users, expenses, notes } from "@shared/schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { expenseRepo } from "../repositories/expenseRepo";
import { userRepo } from "../repositories/userRepo";
import * as bbqService from "../services/bbqService";
import { inviteByUsername } from "../services/inviteService";
import { requireAuth } from "../middleware/requireAuth";
import { publicRateLimit } from "../middleware/publicRateLimit";
import { db } from "../db";
import { getLimits } from "../lib/plan";
import { auditLog, auditSecurity } from "../lib/audit";
import { badRequest, conflict, forbidden, gone, notFound, unauthorized, upgradeRequired } from "../lib/errors";

const router = Router();

/** Strip /api prefix for router mounted at /api */
const p = (path: string) => (path.startsWith("/api") ? path.slice(4) : path);

function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
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

const countryCodeSchema = z.string().length(2, "countryCode must be ISO-3166-1 alpha-2 (2 chars)").transform((s) => s.toUpperCase());
const currencyCodeSchema = z.string().length(3, "currency must be ISO-4217 (3 chars)").transform((s) => s.toUpperCase());
const visibilitySchema = z.enum(["private", "public"]);
const publicModeSchema = z.enum(["marketing", "joinable"]);
const listingStatusSchema = z.enum(["inactive", "active", "expired"]);

router.post(p(api.barbecues.create.path), asyncHandler(async (req, res) => {
  const bodySchema = api.barbecues.create.input.extend({
    date: z.coerce.date(),
    countryCode: countryCodeSchema.optional().nullable(),
    currency: currencyCodeSchema.optional(),
    currencySource: z.enum(["auto", "manual"]).optional(),
    visibility: visibilitySchema.optional(),
    publicMode: publicModeSchema.optional(),
    publicListingStatus: listingStatusSchema.optional(),
    publicListingExpiresAt: z.coerce.date().nullable().optional(),
    organizationName: z.string().max(160).nullable().optional(),
    publicDescription: z.string().max(5000).nullable().optional(),
    bannerImageUrl: z.string().url().nullable().optional(),
  });
  const parsed = bodySchema.parse(req.body);
  const input = {
    ...parsed,
    currencySource: (parsed.currencySource as "auto" | "manual" | undefined) ?? "auto",
  };
  const created = await bbqService.createBarbecue(input, req.session?.username);
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

/** Ensure event has invite token (backfill for legacy events). Creator only. */
router.post("/barbecues/:id/ensure-invite-token", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can update this event");
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
  if (bbq.creatorId !== req.session!.username) forbidden("Only the creator can update this BBQ");
  const schema = z.object({
    allowOptInExpenses: z.boolean().optional(),
    templateData: z.unknown().optional(),
    status: z.enum(["draft", "active", "settling", "settled"]).optional(),
    locationName: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    countryCode: z.string().length(2).transform((s) => s.toUpperCase()).nullable().optional(),
    countryName: z.string().nullable().optional(),
    placeId: z.string().nullable().optional(),
    currency: z.string().length(3).transform((s) => s.toUpperCase()).optional(),
    currencySource: z.enum(["auto", "manual"]).optional(),
    visibility: visibilitySchema.optional(),
    publicMode: publicModeSchema.optional(),
    publicListingStatus: listingStatusSchema.optional(),
    publicListingExpiresAt: z.coerce.date().nullable().optional(),
    organizationName: z.string().max(160).nullable().optional(),
    publicDescription: z.string().max(5000).nullable().optional(),
    bannerImageUrl: z.string().url().nullable().optional(),
  });
  const body = schema.parse(req.body);
  const updated = await bbqService.updateBarbecue(id, body, req.session!.username);
  if (!updated) notFound("BBQ not found");
  res.json(updated);
}));

router.post("/events/:id/activate-listing", requireAuth, asyncHandler(async (req, res) => {
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
  const inviterUsername = req.session!.username;
  if (!inviterUsername) unauthorized("Not authenticated");
  const created = await inviteByUsername(bbqId, username, inviterUsername);
  res.status(201).json(created);
}));

router.patch(p(api.participants.accept.path), asyncHandler(async (req, res) => {
  const updated = await participantRepo.accept(Number(req.params.id));
  if (!updated) notFound("Participant not found");
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
  const query = ((req.query.q as string) || "").toLowerCase().trim();
  if (!query || query.length < 2) return res.json([]);
  const allUsers = await db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users);
  const results = allUsers
    .filter(
      (u) =>
        u.id !== req.session!.userId &&
        (u.username.toLowerCase().includes(query) || (u.displayName && u.displayName.toLowerCase().includes(query)))
    )
    .slice(0, 10);
  res.json(results);
}));

// Public profile by username (for viewing other users)
router.get("/users/:username", requireAuth, asyncHandler(async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  if (!username) badRequest("Username required");
  const profile = await userRepo.getPublicProfileWithStats(username);
  if (!profile) notFound("User not found");
  res.json(profile);
}));

export default router;
