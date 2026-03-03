// Participant routes: members, invites, participant CRUD/join, invite tokens, and memberships.
import { Router, type Request } from "express";
import { randomUUID } from "crypto";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { api } from "@shared/routes";
import { barbecues, eventInvites, eventMembers, participants, users } from "@shared/schema";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { bbqRepo } from "../repositories/bbqRepo";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { getLimits } from "../lib/plan";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { logPlanActivity } from "../lib/planActivity";
import { badRequest, conflict, forbidden, gone, notFound, unauthorized, upgradeRequired } from "../lib/errors";
import { assertEventAccessOrThrow, asyncHandler, getBarbecueOr404, isEventMemberUser, p } from "./_helpers";

const router = Router();

router.get("/join/:token", asyncHandler(async (req, res) => {
  const item = await participantRepo.getBarbecueByToken(String(req.params.token ?? ""));
  if (!item) notFound("Invite not found");
  if (item.visibility !== "private") forbidden("Invite is only available for private events");
  res.json(item);
}));

router.get("/invites/:token", asyncHandler(async (req, res) => {
  const item = await participantRepo.getBarbecueByToken(String(req.params.token ?? ""));
  if (!item) notFound("Invite not found");
  if (item.visibility !== "private") forbidden("Invite is only available for private events");
  res.json(item);
}));

router.post("/invites/:token/accept", requireAuth, asyncHandler(async (req, res) => {
  const token = String(req.params.token ?? "").trim();
  if (!token) badRequest("Invalid invite token");
  const userId = req.session!.userId;
  const username = req.session!.username;
  if (!userId || !username) unauthorized("Not authenticated");

  const invite = await participantRepo.getBarbecueByToken(token);
  if (!invite) notFound("Invite not found");
  if (invite.visibility !== "private") forbidden("Invite is only available for private events");

  const eventId = Number(invite.id);
  const event = await bbqRepo.getById(eventId);
  if (!event) notFound("Event not found");

  const memberExists = await isEventMemberUser(eventId, userId, username);
  if (!memberExists) {
    await db.insert(eventMembers).values({
      eventId,
      userId,
      role: "member",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
  }

  const me = await userRepo.findById(userId);
  if (me) {
    await db.insert(participants).values({
      barbecueId: eventId,
      name: me.displayName || me.username,
      userId: me.id,
      status: "accepted",
    }).onConflictDoNothing();
  }

  res.json({
    eventId,
    eventName: event.name,
    joined: true,
  });
}));

router.get("/events/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);

  const rows = await db
    .select({
      id: eventMembers.id,
      eventId: eventMembers.eventId,
      userId: eventMembers.userId,
      role: eventMembers.role,
      joinedAt: eventMembers.joinedAt,
      name: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      profileImageUrl: users.profileImageUrl,
    })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(eq(eventMembers.eventId, eventId))
    .orderBy(asc(eventMembers.joinedAt), asc(eventMembers.id));

  const members = rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    name: row.name || row.username,
    username: row.username,
    avatarUrl: row.avatarUrl ?? row.profileImageUrl ?? null,
    role: row.role,
    joinedAt: row.joinedAt,
  }));

  res.json(members);
}));

router.post("/events/:eventId/members", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);

  const parsed = z.object({
    userId: z.coerce.number().int().positive(),
    role: z.enum(["owner", "member"]).optional(),
  }).parse(req.body ?? {});

  const [event] = await db.select().from(barbecues).where(eq(barbecues.id, eventId));
  if (!event) notFound("Event not found");

  const actor = req.session!.username;
  const actorUserId = req.session!.userId;
  if (!actorUserId) unauthorized("Not authenticated");
  if (event.creatorUserId !== actorUserId) forbidden("Only creator can add members");

  const targetUser = await userRepo.findById(parsed.userId);
  if (!targetUser) notFound("User not found");

  await db.insert(eventMembers).values({
    eventId,
    userId: parsed.userId,
    role: parsed.role ?? "member",
    joinedAt: new Date(),
  }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });

  await db.insert(participants).values({
    barbecueId: eventId,
    name: targetUser.displayName || targetUser.username,
    userId: targetUser.id,
    status: "accepted",
  }).onConflictDoNothing();

  const [member] = await db
    .select({
      id: eventMembers.id,
      eventId: eventMembers.eventId,
      userId: eventMembers.userId,
      role: eventMembers.role,
      joinedAt: eventMembers.joinedAt,
      name: users.displayName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      profileImageUrl: users.profileImageUrl,
    })
    .from(eventMembers)
    .innerJoin(users, eq(users.id, eventMembers.userId))
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, parsed.userId)))
    .limit(1);

  if (!member) notFound("Member not found");

  const payload = {
    id: member.id,
    eventId: member.eventId,
    userId: member.userId,
    name: member.name || member.username,
    username: member.username,
    avatarUrl: member.avatarUrl ?? member.profileImageUrl ?? null,
    role: member.role,
    joinedAt: member.joinedAt,
  };

  broadcastEventRealtime(eventId, {
    type: "event:member_joined",
    eventId,
    member: payload,
  });

  await logPlanActivity({
    eventId,
    type: "MEMBER_JOINED",
    actorUserId: req.session!.userId ?? null,
    actorName: actor,
    message: `${payload.name} joined the plan`,
    meta: { userId: payload.userId },
  });

  res.status(201).json(payload);
}));

router.get("/events/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);

  const rows = await db
    .select({
      id: eventInvites.id,
      eventId: eventInvites.eventId,
      inviterUserId: eventInvites.inviterUserId,
      acceptedByUserId: eventInvites.acceptedByUserId,
      email: eventInvites.email,
      status: eventInvites.status,
      expiresAt: eventInvites.expiresAt,
      createdAt: eventInvites.createdAt,
      inviterName: users.displayName,
      inviterUsername: users.username,
    })
    .from(eventInvites)
    .leftJoin(users, eq(users.id, eventInvites.inviterUserId))
    .where(eq(eventInvites.eventId, eventId))
    .orderBy(desc(eventInvites.createdAt));

  res.json(rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    inviterUserId: row.inviterUserId,
    inviterName: row.inviterName || row.inviterUsername || null,
    acceptedByUserId: row.acceptedByUserId,
    email: row.email,
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  })));
}));

router.post("/events/:eventId/invites", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);

  const parsed = z.object({
    email: z.string().trim().email().optional(),
    userId: z.coerce.number().int().positive().optional(),
    expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
  }).parse(req.body ?? {});

  if (!parsed.email && !parsed.userId) badRequest("Provide email or userId");

  const expiresInDays = parsed.expiresInDays ?? 7;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  let targetEmail: string | null = null;
  let targetUserId: number | null = null;
  if (parsed.userId) {
    const targetUser = await userRepo.findById(parsed.userId);
    if (!targetUser) notFound("User not found");
    targetUserId = targetUser.id;
    targetEmail = targetUser.email ?? null;
  } else if (parsed.email) {
    targetEmail = parsed.email.toLowerCase();
    const targetUser = await userRepo.findByEmail(targetEmail);
    if (targetUser) targetUserId = targetUser.id;
  }

  const [created] = await db.insert(eventInvites).values({
    token: randomUUID(),
    eventId,
    inviterUserId: req.session!.userId!,
    acceptedByUserId: targetUserId,
    email: targetEmail,
    status: "pending",
    expiresAt,
  }).returning();

  res.status(201).json(created);
}));

router.post("/events/:eventId/invites/:inviteId/revoke", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const inviteId = String(req.params.inviteId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  if (!inviteId) badRequest("Invalid invite id");
  await assertEventAccessOrThrow(req, eventId);

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

router.post("/barbecues/:id/ensure-invite-token", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  await assertEventAccessOrThrow(req, id);
  const updated = await bbqRepo.ensureInviteToken(id);
  if (!updated) notFound("Event not found");
  res.json(updated);
}));

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
  const creatorUser = bbq.creatorUserId ? await userRepo.findById(bbq.creatorUserId) : undefined;
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
    const user = await userRepo.findById(created.userId);
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
  const creatorUser = bbq.creatorUserId ? await userRepo.findById(bbq.creatorUserId) : undefined;
  const limits = getLimits(creatorUser ?? undefined);
  const participantCount = await participantRepo.countByBbq(bbqId);
  if (participantCount >= limits.maxParticipantsPerEvent) {
    upgradeRequired("more_participants", { current: participantCount, max: limits.maxParticipantsPerEvent });
  }
  const joinUserId = Number(input.userId);
  if (!Number.isInteger(joinUserId) || joinUserId <= 0) badRequest("Invalid userId");
  const existing = await participantRepo.getMemberships(joinUserId);
  const alreadyIn = existing.find((m) => m.bbqId === bbqId);
  if (alreadyIn) {
    conflict(alreadyIn.status === "accepted" ? "already_joined" : "already_pending");
  }
  const created = await participantRepo.joinBarbecue(bbqId, input.name, joinUserId);
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
      eq(participants.userId, targetUser.id),
    ),
  );
  if (existing[0]) conflict("already_member");
  const created = await participantRepo.inviteUser(bbqId, targetUser.username, targetUser.id);
  res.status(201).json(created);
}));

router.patch(p(api.participants.accept.path), asyncHandler(async (req, res) => {
  const updated = await participantRepo.accept(Number(req.params.id));
  if (!updated) notFound("Participant not found");
  const user = updated.userId ? await userRepo.findById(updated.userId) : null;
  if (updated.userId) {
    await db.insert(eventMembers).values({
      eventId: updated.barbecueId,
      userId: updated.userId,
      role: "member",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    broadcastEventRealtime(updated.barbecueId, {
      type: "event:member_joined",
      eventId: updated.barbecueId,
      member: {
        userId: updated.userId,
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
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const id = Number(req.params.id);
  const input = api.participants.update.input.parse(req.body);
  const participant = await participantRepo.getById(id);
  if (!participant) notFound("Participant not found");
  if (participant.userId !== userId) forbidden("Can only edit your own name");
  const updated = await participantRepo.updateName(id, input.name);
  if (!updated) notFound("Participant not found");
  res.json(updated);
}));

router.delete(p(api.participants.delete.path), requireAuth, asyncHandler(async (req, res) => {
  const participantId = Number(req.params.id);
  if (!Number.isInteger(participantId) || participantId <= 0) badRequest("Invalid participant id");
  const sessionUserId = req.session?.userId;
  if (!sessionUserId) unauthorized("Not authenticated");

  const participant = await participantRepo.getById(participantId);
  if (!participant) notFound("Participant not found");

  const bbq = await bbqRepo.getById(participant.barbecueId);
  if (!bbq) notFound("Plan not found");

  const isSelfLeave = participant.userId === sessionUserId;
  const isCreator = bbq.creatorUserId === sessionUserId;
  if (!isSelfLeave && !isCreator) forbidden("Not allowed to remove this participant");

  const outcome = await db.transaction(async (tx) => {
    const removeEventMemberByUserId = async (userId: number | null | undefined) => {
      if (!userId) return;
      await tx
        .delete(eventMembers)
        .where(and(eq(eventMembers.eventId, participant.barbecueId), eq(eventMembers.userId, userId)));
    };

    if (isSelfLeave && participant.userId === bbq.creatorUserId) {
      const [successor] = await tx
        .select({ id: participants.id, userId: participants.userId })
        .from(participants)
        .where(and(
          eq(participants.barbecueId, participant.barbecueId),
          eq(participants.status, "accepted"),
          sql`${participants.id} <> ${participant.id}`,
          isNotNull(participants.userId),
        ))
        .orderBy(asc(participants.id))
        .limit(1);

      if (typeof successor?.userId === "number") {
        await tx
          .update(barbecues)
          .set({ creatorUserId: successor.userId, updatedAt: new Date() })
          .where(eq(barbecues.id, participant.barbecueId));
        await tx.delete(participants).where(eq(participants.id, participant.id));
        await removeEventMemberByUserId(participant.userId);
        return { deletedPlan: false };
      }

      await tx.delete(barbecues).where(eq(barbecues.id, participant.barbecueId));
      return { deletedPlan: true };
    }

    await tx.delete(participants).where(eq(participants.id, participant.id));
    await removeEventMemberByUserId(participant.userId);

    const [remaining] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(participants)
      .where(and(eq(participants.barbecueId, participant.barbecueId), eq(participants.status, "accepted")));
    if (Number(remaining?.count ?? 0) <= 0) {
      await tx.delete(barbecues).where(eq(barbecues.id, participant.barbecueId));
      return { deletedPlan: true };
    }
    return { deletedPlan: false };
  });

  if (outcome.deletedPlan) {
    broadcastEventRealtime(participant.barbecueId, {
      type: "plan:deleted",
      eventId: participant.barbecueId,
      deletedPlanId: participant.barbecueId,
    });
  } else {
    broadcastEventRealtime(participant.barbecueId, {
      type: "event:member_left",
      eventId: participant.barbecueId,
      userId: sessionUserId,
    });
  }

  res.status(204).send();
}));

router.get(p(api.memberships.list.path), asyncHandler(async (req, res) => {
  const rawUserId = (req.query.userId as string | undefined) ?? String(req.session?.userId ?? "");
  const userId = Number(rawUserId);
  if (!Number.isInteger(userId) || userId <= 0) return res.json([]);
  const memberships = await participantRepo.getMemberships(userId);
  res.json(memberships);
}));

export default router;
