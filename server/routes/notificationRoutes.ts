// Notifications routes: event notifications, pending plan invites, friend requests summary/actions.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { eventInvites, eventMembers, participants } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { bbqRepo } from "../repositories/bbqRepo";
import { db } from "../db";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { logPlanActivity } from "../lib/planActivity";
import { sendPushToUser } from "../lib/webPush";
import { badRequest, conflict, forbidden, gone, notFound, unauthorized } from "../lib/errors";
import { assertMembersWritable, asyncHandler, listPendingPlanInvitesForUser } from "./_helpers";

const router = Router();

router.get("/notifications/events", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId;
  if (!userId) return res.json([]);
  const items = await bbqRepo.getEventNotificationsForUser(userId);
  res.json(items);
}));

router.patch("/notifications/events/:id/read", requireAuth, asyncHandler(async (req, res) => {
  await bbqRepo.markEventNotificationRead(Number(req.params.id));
  res.status(204).send();
}));

router.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const friendRequests = await participantRepo.getFriendRequests(userId);
  const planInvites = await listPendingPlanInvitesForUser(userId);
  res.json({ friendRequests, planInvites });
}));

router.get("/plans/invites/pending", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const items = await listPendingPlanInvitesForUser(userId);
  res.json(items);
}));

router.post("/plans/invites/:inviteId/accept", requireAuth, asyncHandler(async (req, res) => {
  const inviteId = String(req.params.inviteId ?? "").trim();
  if (!inviteId) badRequest("Invalid invite id");
  const userId = req.session!.userId!;
  const me = await userRepo.findById(userId);
  if (!me) unauthorized("Not authenticated");

  const invite = await db.transaction(async (tx) => {
    const row = await tx.select().from(eventInvites).where(eq(eventInvites.id, inviteId)).limit(1);
    const current = row[0];
    if (!current) notFound("Invite not found");
    await assertMembersWritable(current.eventId);
    if (current.status !== "pending") conflict("Invite already handled");
    if (current.expiresAt.getTime() <= Date.now()) gone("Invite expired");
    const canHandle =
      (current.acceptedByUserId && current.acceptedByUserId === userId)
      || (!current.acceptedByUserId && current.email && me.email && current.email.toLowerCase() === me.email.toLowerCase());
    if (!canHandle) forbidden("Invite does not belong to this user");

    const now = new Date();
    await tx.update(eventInvites).set({
      status: "accepted",
      acceptedByUserId: userId,
      acceptedAt: now,
    }).where(eq(eventInvites.id, current.id));
    await tx.insert(eventMembers).values({
      eventId: current.eventId,
      userId,
      role: "member",
      joinedAt: now,
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    await tx.insert(participants).values({
      barbecueId: current.eventId,
      name: me.displayName || me.username,
      userId: me.id,
      status: "accepted",
    }).onConflictDoNothing();
    return { ...current, acceptedAt: now };
  });

  broadcastEventRealtime(invite.eventId, {
    type: "event:member_joined",
    eventId: Number(invite.eventId),
    member: {
      userId: Number(userId),
      name: me.displayName || me.username,
      username: me.username,
      avatarUrl: me.avatarUrl ?? me.profileImageUrl ?? null,
      role: "member",
      joinedAt: (invite.acceptedAt ?? new Date()).toISOString(),
    },
  });
  await logPlanActivity({
    eventId: invite.eventId,
    type: "MEMBER_JOINED",
    actorUserId: userId,
    actorName: me.displayName || me.username,
    message: `${me.displayName || me.username} joined the plan`,
    meta: { userId },
  });

  const event = await bbqRepo.getById(invite.eventId);
  if (event?.creatorUserId && event.creatorUserId !== userId) {
    await sendPushToUser(
      event.creatorUserId,
      "Plan invite accepted",
      `${me.displayName || me.username} joined ${event.name}.`,
      `/app/e/${invite.eventId}`,
      "planInvites",
    );
  }
  res.json({
    inviteId: invite.id,
    eventId: invite.eventId,
    eventName: event?.name ?? "Plan",
    membership: {
      eventId: invite.eventId,
      userId,
      role: "member",
    },
  });
}));

router.post("/plans/invites/:inviteId/decline", requireAuth, asyncHandler(async (req, res) => {
  const inviteId = String(req.params.inviteId ?? "").trim();
  if (!inviteId) badRequest("Invalid invite id");
  const userId = req.session!.userId!;
  const me = await userRepo.findById(userId);
  if (!me) unauthorized("Not authenticated");

  const [invite] = await db.select().from(eventInvites).where(eq(eventInvites.id, inviteId)).limit(1);
  if (!invite) notFound("Invite not found");
  if (invite.status !== "pending") conflict("Invite already handled");
  const canHandle =
    (invite.acceptedByUserId && invite.acceptedByUserId === userId)
    || (!invite.acceptedByUserId && invite.email && me.email && invite.email.toLowerCase() === me.email.toLowerCase());
  if (!canHandle) forbidden("Invite does not belong to this user");

  await db.update(eventInvites).set({
    status: "declined",
    acceptedByUserId: invite.acceptedByUserId ?? userId,
  }).where(eq(eventInvites.id, invite.id));

  res.json({ inviteId: invite.id, status: "declined" });
}));

export default router;
