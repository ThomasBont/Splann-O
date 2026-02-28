import { Router, type Request } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { bbqRepo } from "../repositories/bbqRepo";
import { userRepo } from "../repositories/userRepo";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { log } from "../lib/logger";
import { AppError, badRequest, forbidden, notFound } from "../lib/errors";
import { eventInvites, eventMembers, participants, users } from "@shared/schema";

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

function getAppOrigin(req: Request) {
  return (process.env.APP_URL ?? process.env.APP_BASE_URL ?? "").replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
}

async function assertEventAccessOrThrow(req: Request, eventId: number) {
  const userId = req.session?.userId;
  const username = req.session?.username;
  if (!userId || !username) {
    throw forbidden("Not a member of this event");
  }

  const event = await bbqRepo.getById(eventId);
  if (!event) notFound("Event not found");

  if (event.creatorId) {
    const owner = await userRepo.findByUsername(event.creatorId);
    if (owner) {
      await db.insert(eventMembers).values({
        eventId,
        userId: owner.id,
        role: "owner",
        joinedAt: new Date(),
      }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    }
  }

  if (event.creatorId === username) {
    await db.insert(eventMembers).values({
      eventId,
      userId,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    return;
  }

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
      avatarUrl: row.avatarUrl ?? row.profileImageUrl ?? null,
      role: row.role,
      joinedAt: row.joinedAt ? row.joinedAt.toISOString() : null,
    })));
  } catch (err) {
    return handleEventsRouteError("GET /api/events/:eventId/members", req, err, res);
  }
}));

router.post("/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
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
      role: "member" as "member" | "owner",
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
    return handleEventsRouteError("GET /api/events/:eventId/invites", req, err, res);
  }
}));

router.post("/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
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
    return handleEventsRouteError("POST /api/events/:eventId/invites", req, err, res);
  }
}));

export default router;
