import { Router, type Request } from "express";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { bbqRepo } from "../repositories/bbqRepo";
import { userRepo } from "../repositories/userRepo";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { listPlanActivity, logPlanActivity } from "../lib/planActivity";
import { log } from "../lib/logger";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors";
import { eventInvites, eventMembers, participants, users } from "@shared/schema";
import { resolveUserAvatarUrl } from "../lib/assets";
import { assertEventCreatorOrThrow, assertInvitesWritable, assertMembersWritable } from "./_helpers";

const router = Router();

function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
}

function isMissingSchemaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return message.includes("does not exist") || message.includes("relation") || message.includes("column");
}

function handleEventsRouteError(route: string, req: Request, err: unknown, res: { status: (code: number) => { json: (payload: object) => unknown } }): void {
  const status = err instanceof AppError ? err.status : 500;
  const code = err instanceof AppError ? err.code : "INTERNAL_ERROR";
  log("error", "Events route failed", {
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

async function assertEventAccessOrThrow(req: Request, eventId: number) {
  const userId = req.session?.userId;
  const username = req.session?.username;
  if (!userId || !username) {
    throw forbidden("Not a member of this event");
  }

  const event = await bbqRepo.getById(eventId);
  if (!event) notFound("Event not found");

  if (event.creatorUserId) {
    await db.insert(eventMembers).values({
      eventId,
      userId: event.creatorUserId,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
  }
  if (event.creatorUserId === userId) return;

  const [member] = await db
    .select({ id: eventMembers.id })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, userId)))
    .limit(1);
  if (!member) forbidden("Not a member of this event");
}

router.get("/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
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
        avatarAssetId: users.avatarAssetId,
        profileImageUrl: users.profileImageUrl,
      })
      .from(eventMembers)
      .innerJoin(users, eq(users.id, eventMembers.userId))
      .where(eq(eventMembers.eventId, eventId))
      .orderBy(desc(eventMembers.joinedAt));

    res.json(rows.map((row) => ({
      userId: Number(row.userId),
      name: row.displayName || row.username,
      username: row.username,
      avatarUrl: resolveUserAvatarUrl(row),
      role: row.role,
      joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
    })));
  } catch (err) {
    return handleEventsRouteError("GET /api/events/:eventId/members", req, err, res);
  }
}));

router.get("/:eventId/activity", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    const limit = Number(req.query.limit ?? 10);
    const items = await listPlanActivity(eventId, limit);
    res.json({ items });
  } catch (err) {
    return handleEventsRouteError("GET /api/events/:eventId/activity", req, err, res);
  }
}));

router.post("/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    await assertEventCreatorOrThrow(req, eventId);
    await assertMembersWritable(eventId);
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
      userId: targetUser.id,
      status: "accepted",
    }).onConflictDoNothing();

    const memberPayload = {
      userId: Number(targetUser.id),
      name: targetUser.displayName || targetUser.username,
      username: targetUser.username,
      avatarUrl: resolveUserAvatarUrl(targetUser),
      role: "member" as "member" | "owner",
      joinedAt: (inserted[0]?.joinedAt ?? now).toISOString(),
    };

    if (inserted[0]) {
      await logPlanActivity({
        eventId,
        type: "MEMBER_JOINED",
        actorUserId: targetUser.id,
        actorName: targetUser.displayName || targetUser.username,
        message: `${targetUser.displayName || targetUser.username} joined the plan`,
        meta: { userId: targetUser.id },
      });
      broadcastEventRealtime(eventId, {
        type: "event:member_joined",
        eventId: Number(eventId),
        member: memberPayload,
      });
    }

    res.status(200).json(memberPayload);
  } catch (err) {
    return handleEventsRouteError("POST /api/events/:eventId/members", req, err, res);
  }
}));

router.get("/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    const status = String(req.query.status ?? "pending");

    const rows = await db.select().from(eventInvites)
      .where(and(eq(eventInvites.eventId, eventId), eq(eventInvites.status, status), isNotNull(eventInvites.acceptedByUserId)))
      .orderBy(desc(eventInvites.createdAt));

    const inviteeIds = Array.from(
      new Set(
        rows
          .map((row) => row.acceptedByUserId)
          .filter((value): value is number => typeof value === "number"),
      ),
    );
    const invitees = inviteeIds.length > 0
      ? await db
          .select({
            id: users.id,
            displayName: users.displayName,
            username: users.username,
            avatarUrl: users.avatarUrl,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(inArray(users.id, inviteeIds))
      : [];
    const inviteeById = new Map(invitees.map((user) => [user.id, user]));

    res.json(rows.map((row) => ({
      id: row.id,
      email: row.email,
      inviteeUserId: row.acceptedByUserId ? Number(row.acceptedByUserId) : null,
      inviteType: row.acceptedByUserId ? "user" : "link",
      invitee: row.acceptedByUserId && inviteeById.get(Number(row.acceptedByUserId))
        ? {
            userId: Number(row.acceptedByUserId),
            name: inviteeById.get(Number(row.acceptedByUserId))!.displayName || inviteeById.get(Number(row.acceptedByUserId))!.username,
            username: inviteeById.get(Number(row.acceptedByUserId))!.username,
            avatarUrl: resolveUserAvatarUrl(inviteeById.get(Number(row.acceptedByUserId))!),
          }
        : null,
      status: row.status,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      expiresAt: row.expiresAt.toISOString(),
    })));
  } catch (err) {
    return handleEventsRouteError("GET /api/events/:eventId/invites", req, err, res);
  }
}));

router.post("/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isFinite(eventId)) badRequest("Invalid event id");
    await assertEventAccessOrThrow(req, eventId);
    await assertInvitesWritable(eventId);

    const body = req.body ?? {};
    if (typeof body.email === "string" && body.email.trim().length > 0) {
      return res.status(410).json({
        code: "INVITE_LINKS_DISABLED",
        message: "Invite links are disabled. Invite friends in-app instead.",
      });
    }

    const parsed = z.object({
      userId: z.coerce.number().int().positive(),
    }).parse(body);
    const invitee = await userRepo.findById(parsed.userId);
    if (!invitee) notFound("User not found");

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const [invite] = await db.insert(eventInvites).values({
      eventId,
      inviterUserId: req.session!.userId!,
      email: invitee.email ?? null,
      token,
      status: "pending",
      expiresAt,
      // Reuse acceptedByUserId as invite target user for in-app invite flow.
      acceptedByUserId: invitee.id,
    }).returning();

    broadcastEventRealtime(eventId, {
      type: "event:invite_created",
      eventId: Number(eventId),
      invite: {
        id: invite.id,
        email: invite.email,
        inviteeUserId: invite.acceptedByUserId ? Number(invite.acceptedByUserId) : null,
        inviteType: invite.acceptedByUserId ? "user" : "link",
        invitee: invite.acceptedByUserId && invitee
          ? {
              userId: Number(invitee.id),
              name: invitee.displayName || invitee.username,
              username: invitee.username,
              avatarUrl: resolveUserAvatarUrl(invitee),
            }
          : null,
        status: invite.status,
        createdAt: invite.createdAt ? invite.createdAt.toISOString() : null,
        expiresAt: invite.expiresAt.toISOString(),
      },
    });

    await logPlanActivity({
      eventId,
      type: "INVITE_CREATED",
      actorUserId: req.session!.userId ?? null,
      actorName: req.session?.username ?? null,
      message: `${invitee.displayName || invitee.username} was invited to the plan`,
      meta: {
        inviteId: invite.id,
        inviteeUserId: invitee.id,
        inviteeName: invitee.displayName || invitee.username,
      },
    });

    res.status(201).json({
      inviteId: invite.id,
      inviteeUserId: invite.acceptedByUserId ? Number(invite.acceptedByUserId) : null,
      email: invite.email,
      status: invite.status,
      createdAt: invite.createdAt ? invite.createdAt.toISOString() : null,
      expiresAt: invite.expiresAt.toISOString(),
    });
  } catch (err) {
    return handleEventsRouteError("POST /api/events/:eventId/invites", req, err, res);
  }
}));

export default router;
