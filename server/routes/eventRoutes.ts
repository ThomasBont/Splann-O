// Event routes: plan CRUD, access/read, update/delete/leave, settle-up, listing activation/deactivation, and activity.
import { Router, type Request } from "express";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { api } from "@shared/routes";
import { barbecues, eventMembers, participants, planActivity } from "@shared/schema";
import { optionalCountryCodeSchema } from "@shared/lib/country-code-schema";
import {
  derivePlanTypeSelection,
  getPlanTypeDisplayLabel,
  isSubcategoryForMainType,
  normalizePlanMainType,
  normalizePlanSubcategory,
} from "@shared/lib/plan-types";
import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { expenseRepo } from "../repositories/expenseRepo";
import { userRepo } from "../repositories/userRepo";
import { requireAuth } from "../middleware/requireAuth";
import * as bbqService from "../services/bbqService";
import { db } from "../db";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { getLimits } from "../lib/plan";
import { listPlanActivity, logPlanActivity } from "../lib/planActivity";
import { postSystemChatMessage } from "../lib/systemChat";
import { ensureAutoSettlement, ensureSettlementForView, getLatestSettlement, getSettlementById, markSettlementTransferPaid } from "../lib/settlement";
import { log } from "../lib/logger";
import { auditLog, auditSecurity } from "../lib/audit";
import { badRequest, forbidden, notFound, unauthorized, upgradeRequired } from "../lib/errors";
import {
  assertEventAccessOrThrow,
  asyncHandler,
  currencyCodeSchema,
  getBarbecueOr404,
  isAdmin,
  listingStatusSchema,
  p,
  PRIVATE_MAIN_CATEGORIES,
  PRIVATE_SUBCATEGORIES_BY_MAIN,
  publicImagePathOrUrlSchema,
  publicModeSchema,
  publicTemplateSchema,
  visibilityOriginSchema,
  visibilitySchema,
} from "./_helpers";

const router = Router();

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
    planCurrency: currencyCodeSchema.optional(),
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
    bannerImageUrl: z.union([publicImagePathOrUrlSchema, z.literal("")]).nullable().optional(),
    bannerAssetId: z.string().min(1).nullable().optional(),
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
    bannerImageUrl: parsed.bannerImageUrl === "" ? null : parsed.bannerImageUrl,
    currencySource: parsed.currencySource as "auto" | "manual" | undefined,
  };
  const created = await bbqService.createBarbecue(input, req.session?.username);
  const ownerUserId = req.session!.userId!;
  await db.insert(eventMembers).values({
    eventId: created.id,
    userId: ownerUserId,
    role: "owner",
    joinedAt: new Date(),
  }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
  res.status(201).json(created);
}));

router.get("/plans/:id/activity", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, id);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);

  const [member] = await db
    .select({ lastReadActivityAt: eventMembers.lastReadActivityAt })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, userId)))
    .limit(1);
  const cutoff = member?.lastReadActivityAt ?? new Date(0);

  const items = await listPlanActivity(id, limit);
  const [unreadRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(planActivity)
    .where(and(eq(planActivity.eventId, id), sql`${planActivity.createdAt} > ${cutoff}`));

  res.json({
    items,
    unreadCount: Number(unreadRow?.count ?? 0),
  });
}));

router.get("/events/:eventId/settlement/latest", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  let latest = await getLatestSettlement(eventId);
  if (!latest) {
    await ensureAutoSettlement(eventId);
    latest = await getLatestSettlement(eventId);
  }
  if (!latest) {
    res.json({ settlement: null, transfers: [] });
    return;
  }
  res.json(latest);
}));

router.post("/events/:eventId/settlement/ensure", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorUserId !== userId) {
    res.status(403).json({
      code: "only_creator_can_start_settlement",
      message: "Only the plan creator can start settlement.",
    });
    return;
  }

  await ensureSettlementForView(eventId);
  const latest = await getLatestSettlement(eventId);
  res.json({
    ensured: true,
    hasSettlement: !!latest?.settlement,
    settlementId: latest?.settlement?.id ?? null,
    latest: latest ?? { settlement: null, transfers: [] },
  });
}));

router.post("/events/:eventId/settlement/manual", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const bbq = await bbqRepo.getById(eventId);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorUserId !== userId) {
    res.status(403).json({
      code: "only_creator_can_start_settlement",
      message: "Only the plan creator can start settlement.",
    });
    return;
  }

  await ensureSettlementForView(eventId);
  const latest = await getLatestSettlement(eventId);
  res.json({
    ensured: true,
    hasSettlement: !!latest?.settlement,
    settlementId: latest?.settlement?.id ?? null,
    latest: latest ?? { settlement: null, transfers: [] },
  });
}));

router.get("/events/:eventId/settlement/:settlementId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const settlementId = String(req.params.settlementId ?? "").trim();
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  if (!settlementId) badRequest("Invalid settlement id");
  await assertEventAccessOrThrow(req, eventId);
  const settlement = await getSettlementById(eventId, settlementId);
  if (!settlement) {
    res.json({ settlement: null, transfers: [] });
    return;
  }
  res.json(settlement);
}));

router.post("/events/:eventId/settlement/:settlementId/transfers/:transferId/mark-paid", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const settlementId = String(req.params.settlementId ?? "").trim();
  const transferId = String(req.params.transferId ?? "").trim();
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  if (!settlementId) badRequest("Invalid settlement id");
  if (!transferId) badRequest("Invalid transfer id");
  await assertEventAccessOrThrow(req, eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const settlement = await getSettlementById(eventId, settlementId);
  if (!settlement?.settlement) notFound("Settlement not found");
  const transfer = settlement.transfers.find((row) => row.id === transferId);
  if (!transfer) notFound("Transfer not found");
  const isTransferParticipant = transfer.fromUserId === userId || transfer.toUserId === userId;
  if (!isTransferParticipant) {
    res.status(403).json({
      code: "not_transfer_participant",
      message: "Only the payer or receiver can mark this transfer as paid.",
    });
    return;
  }

  if (transfer.paidAt) {
    res.json({
      transferId: transfer.id,
      paidAt: transfer.paidAt,
    });
    return;
  }

  const updated = await markSettlementTransferPaid({
    eventId,
    settlementId,
    transferId,
    paidByUserId: userId,
  });
  if (!updated) notFound("Transfer not found");
  res.json({
    transferId: updated.id,
    paidAt: updated.paidAt ? updated.paidAt.toISOString() : null,
  });
}));

router.post("/plans/:id/activity/read", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, id);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");

  const body = z.object({
    readUpTo: z.coerce.date().optional(),
  }).optional().parse(req.body ?? {});
  const readAt = body?.readUpTo ?? new Date();

  const [updated] = await db
    .update(eventMembers)
    .set({ lastReadActivityAt: readAt })
    .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, userId)))
    .returning({ eventId: eventMembers.eventId, lastReadActivityAt: eventMembers.lastReadActivityAt });

  if (!updated) {
    const [inserted] = await db
      .insert(eventMembers)
      .values({
        eventId: id,
        userId,
        role: "member",
        joinedAt: new Date(),
        lastReadActivityAt: readAt,
      })
      .onConflictDoUpdate({
        target: [eventMembers.eventId, eventMembers.userId],
        set: { lastReadActivityAt: readAt },
      })
      .returning({ eventId: eventMembers.eventId, lastReadActivityAt: eventMembers.lastReadActivityAt });

    res.json({
      planId: inserted?.eventId ?? id,
      lastReadActivityAt: inserted?.lastReadActivityAt ? inserted.lastReadActivityAt.toISOString() : readAt.toISOString(),
    });
    return;
  }

  res.json({
    planId: updated.eventId,
    lastReadActivityAt: updated.lastReadActivityAt ? updated.lastReadActivityAt.toISOString() : readAt.toISOString(),
  });
}));

router.get(p(api.barbecues.get.path), asyncHandler(async (req, res) => {
  const item = await getBarbecueOr404(req, Number(req.params.id), "BBQ not found");
  res.json(item);
}));

router.delete(p(api.barbecues.delete.path), requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) badRequest("Invalid plan id");

  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Plan not found");
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  if (bbq.creatorUserId !== userId) forbidden("Only the creator can delete this plan");

  await db.transaction(async (tx) => {
    await tx.delete(barbecues).where(eq(barbecues.id, id));
  });

  broadcastEventRealtime(id, {
    type: "plan:deleted",
    eventId: id,
    deletedPlanId: id,
  });

  if (process.env.NODE_ENV !== "production") {
    log("info", "plan_deleted", { planId: id, creatorUserId: userId });
  }

  res.json({ ok: true, deletedPlanId: id });
}));

async function handleLeavePlan(req: Request, res: any, planIdRaw: string | undefined) {
  const id = Number(planIdRaw);
  if (!Number.isInteger(id) || id <= 0) badRequest("Invalid plan id");

  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Plan not found");

  const sessionUserId = req.session?.userId;
  if (!sessionUserId) unauthorized("Not authenticated");

  const memberRows = await db
    .select({ id: eventMembers.id })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, sessionUserId)))
    .limit(1);
  const isMember = !!memberRows[0];
  if (!isMember) forbidden("You are not a member of this plan");

  const outcome = await db.transaction(async (tx) => {
    if (bbq.creatorUserId !== sessionUserId) {
      await tx
        .delete(eventMembers)
        .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, sessionUserId)));
      await tx
        .delete(participants)
        .where(and(eq(participants.barbecueId, id), eq(participants.userId, sessionUserId)));
      return { planDeleted: false, newCreatorId: null as number | null };
    }

    const [successor] = await tx
      .select({ userId: eventMembers.userId })
      .from(eventMembers)
      .where(and(eq(eventMembers.eventId, id), sql`${eventMembers.userId} <> ${sessionUserId}`))
      .orderBy(asc(eventMembers.joinedAt), asc(eventMembers.id))
      .limit(1);

    if (!successor) {
      await tx.delete(barbecues).where(eq(barbecues.id, id));
      return { planDeleted: true, newCreatorId: null as number | null };
    }

    await tx
      .update(barbecues)
      .set({ creatorUserId: successor.userId, updatedAt: new Date() })
      .where(eq(barbecues.id, id));
    await tx
      .update(eventMembers)
      .set({ role: "owner" })
      .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, successor.userId)));
    await tx
      .delete(eventMembers)
      .where(and(eq(eventMembers.eventId, id), eq(eventMembers.userId, sessionUserId)));
    await tx
      .delete(participants)
      .where(and(eq(participants.barbecueId, id), eq(participants.userId, sessionUserId)));

    return { planDeleted: false, newCreatorId: successor.userId };
  });

  if (outcome.planDeleted) {
    broadcastEventRealtime(id, {
      type: "plan:deleted",
      eventId: id,
      deletedPlanId: id,
    });
  } else {
    broadcastEventRealtime(id, {
      type: "event:member_left",
      eventId: id,
      userId: sessionUserId,
    });
    await logPlanActivity({
      eventId: id,
      type: "MEMBER_LEFT",
      actorUserId: sessionUserId,
      actorName: req.session?.username ?? null,
      message: `${req.session?.username || "Someone"} left the plan`,
      meta: { userId: sessionUserId },
    });
    await postSystemChatMessage(id, `${req.session?.username || "Someone"} left the plan`);
    if (outcome.newCreatorId) {
      broadcastEventRealtime(id, {
        type: "plan:creator_changed",
        eventId: id,
        newCreatorId: outcome.newCreatorId,
      });
    }
  }

  res.json({
    ok: true,
    left: true,
    planDeleted: outcome.planDeleted,
    newCreatorId: outcome.newCreatorId,
  });
}

router.post(p(api.barbecues.leave.path), requireAuth, asyncHandler(async (req, res) => {
  await handleLeavePlan(req, res, String(req.params.id ?? ""));
}));

router.post("/plans/:planId/leave", requireAuth, asyncHandler(async (req, res) => {
  await handleLeavePlan(req, res, String(req.params.planId ?? ""));
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
    bannerImageUrl: z.union([publicImagePathOrUrlSchema, z.literal("")]).nullable().optional(),
    bannerAssetId: z.string().min(1).nullable().optional(),
  });
  const body = schema.parse(req.body);
  if (body.bannerImageUrl === "") body.bannerImageUrl = null;
  if (body.bannerAssetId !== undefined && body.bannerAssetId !== null && body.bannerAssetId !== "") {
    body.bannerImageUrl = null;
  }
  if ((body.visibilityOrigin ?? bbq.visibilityOrigin ?? "private") === "private" && body.templateData && typeof body.templateData === "object") {
    const templateData = body.templateData as Record<string, unknown>;
    const rawMainCategory = templateData.mainCategory ?? templateData.privateMainCategory ?? null;
    const rawSubCategory = templateData.subCategory ?? templateData.privateSubCategory ?? null;
    const mainCategory = normalizePlanMainType(rawMainCategory);
    const subCategory = normalizePlanSubcategory(rawSubCategory);
    if (rawMainCategory != null && !mainCategory) {
      badRequest("Invalid mainCategory");
    }
    if (rawSubCategory != null && !subCategory) {
      badRequest("Invalid subCategory");
    }
    if (mainCategory && subCategory && !isSubcategoryForMainType(mainCategory, subCategory)) {
      badRequest("Invalid subCategory for mainCategory");
    }
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
  const updated = await bbqService.updateBarbecue(id, body, req.session!.username, req.session!.userId);
  if (!updated) notFound("BBQ not found");
  const previousPlanType = derivePlanTypeSelection({ templateData: bbq.templateData, eventType: bbq.eventType });
  const nextPlanType = derivePlanTypeSelection({
    templateData: body.templateData ?? bbq.templateData,
    eventType: body.eventType ?? bbq.eventType,
  });
  const planTypeChanged = previousPlanType.mainType !== nextPlanType.mainType || previousPlanType.subcategory !== nextPlanType.subcategory;
  const actor = req.session?.username ?? "Someone";
  const planTypeLabel = nextPlanType.mainType
    ? getPlanTypeDisplayLabel(nextPlanType.mainType, nextPlanType.subcategory)
    : "plan";
  await logPlanActivity({
    eventId: id,
    type: "PLAN_UPDATED",
    actorUserId: req.session?.userId ?? null,
    actorName: actor,
    message: planTypeChanged
      ? `${actor} updated the plan type to ${planTypeLabel}`
      : `${actor} updated the plan`,
    meta: {
      changedFields: Object.keys(body),
      ...(planTypeChanged
        ? {
            mainType: nextPlanType.mainType,
            subCategory: nextPlanType.subcategory,
          }
        : {}),
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
  const userId = req.session!.userId;
  const ownerOrAdmin = bbq.creatorUserId === userId || isAdmin(req);
  if (!ownerOrAdmin) forbidden("Only the creator can activate listing");

  let updated: Awaited<ReturnType<typeof bbqService.activateListing>> | undefined;
  if (bbq.creatorUserId === userId) {
    updated = await bbqService.activateListing(id, userId);
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
  const userId = req.session!.userId;
  const ownerOrAdmin = bbq.creatorUserId === userId || isAdmin(req);
  if (!ownerOrAdmin) forbidden("Only the creator can deactivate listing");
  const updated = await bbqRepo.update(id, {
    publicListingStatus: "inactive",
    visibility: "private",
  });
  if (!updated) notFound("Event not found");
  res.json(updated);
}));

router.post("/barbecues/:id/settle-up", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorUserId !== req.session!.userId) forbidden("Only the creator can settle up");
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
  const creatorUser = bbq.creatorUserId ? await userRepo.findById(bbq.creatorUserId) : null;
  const creatorName = creatorUser?.displayName || creatorUser?.username || "Someone";
  const notifications: { userId: number; barbecueId: number; type: string; payload: { creatorName: string; amountOwed: number; eventName: string; currency: string } }[] = [];
  for (const p of participantsList) {
    if (!p.userId || p.userId === bbq.creatorUserId) continue;
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
  await postSystemChatMessage(id, `${req.session?.username || "Someone"} settled up`);
  res.json(updated);
}));

export default router;
