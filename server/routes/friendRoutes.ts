// Friend routes: list, requests, status, send/accept/decline/remove, pending requests, and user search/profile.
import { Router } from "express";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { friendships, users } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { usersSearchLimiter } from "../middleware/rate-limit";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { db } from "../db";
import { log } from "../lib/logger";
import { resolveUserAvatarUrl } from "../lib/assets";
import { badRequest, conflict, notFound } from "../lib/errors";
import { asyncHandler, escapeLikeQuery } from "./_helpers";

const router = Router();

async function getFriendshipForUserOr404(friendshipId: number, userId: number) {
  // Friendship ids are guessable integers; always bind actions to the
  // authenticated user before allowing accept/decline/remove.
  const [friendship] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, friendshipId))
    .limit(1);
  if (!friendship) notFound("Friend request not found");
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    notFound("Friend request not found");
  }
  return friendship;
}

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

router.get("/friends/status", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session!.userId!;
  const raw = String(req.query.userIds ?? "").trim();
  const userIds = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0 && value !== me),
    ),
  );

  if (userIds.length === 0) {
    return res.json({ statuses: {} as Record<string, "friends" | "not_friends" | "pending_outgoing" | "pending_incoming"> });
  }

  const rows = await db
    .select({
      requesterId: friendships.requesterId,
      addresseeId: friendships.addresseeId,
      status: friendships.status,
    })
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me), inArray(friendships.addresseeId, userIds)),
        and(eq(friendships.addresseeId, me), inArray(friendships.requesterId, userIds)),
      ),
    );

  const statuses: Record<string, "friends" | "not_friends" | "pending_outgoing" | "pending_incoming"> = {};
  userIds.forEach((id) => {
    statuses[String(id)] = "not_friends";
  });

  const priority = {
    not_friends: 0,
    pending_outgoing: 1,
    pending_incoming: 1,
    friends: 2,
  } as const;

  for (const row of rows) {
    const otherId = row.requesterId === me ? row.addresseeId : row.requesterId;
    let nextStatus: "friends" | "not_friends" | "pending_outgoing" | "pending_incoming" = "not_friends";
    const normalizedStatus = String(row.status ?? "").toLowerCase();
    if (normalizedStatus === "accepted") {
      nextStatus = "friends";
    } else if (normalizedStatus === "pending") {
      nextStatus = row.requesterId === me ? "pending_outgoing" : "pending_incoming";
    }
    const key = String(otherId);
    const current = statuses[key] ?? "not_friends";
    if (priority[nextStatus] >= priority[current]) {
      statuses[key] = nextStatus;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    log("info", "Friend status resolved", {
      route: "GET /api/friends/status",
      me,
      requestedUserIds: userIds,
      matchedRows: rows.length,
      statuses,
    });
  }

  res.json({ statuses });
}));

router.post("/friends/requests", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session!.userId!;
  const { toUserId } = z.object({ toUserId: z.coerce.number().int().positive() }).parse(req.body ?? {});
  if (toUserId === me) badRequest("cannot_friend_self");
  const target = await userRepo.findById(toUserId);
  if (!target) notFound("user_not_found");

  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, me), eq(friendships.addresseeId, toUserId)),
        and(eq(friendships.requesterId, toUserId), eq(friendships.addresseeId, me)),
      ),
    )
    .limit(1);

  if (existing[0]) {
    if (existing[0].status === "accepted") {
      return res.status(200).json({ status: "friends" });
    }
    if (existing[0].status === "pending") {
      return res.status(200).json({ status: existing[0].requesterId === me ? "pending_outgoing" : "pending_incoming" });
    }
  }

  await db.insert(friendships).values({
    requesterId: me,
    addresseeId: toUserId,
    status: "pending",
  });

  res.status(201).json({ status: "pending_outgoing" });
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
  const friendshipId = Number(req.params.id);
  const me = req.session!.userId!;
  const friendship = await getFriendshipForUserOr404(friendshipId, me);
  if (friendship.addresseeId !== me || friendship.status !== "pending") {
    conflict("friend_request_not_pending");
  }
  await participantRepo.acceptFriendRequest(friendshipId);
  res.json({ ok: true });
}));

router.post("/friends/requests/:id/accept", requireAuth, asyncHandler(async (req, res) => {
  const friendshipId = Number(req.params.id);
  const me = req.session!.userId!;
  const friendship = await getFriendshipForUserOr404(friendshipId, me);
  if (friendship.addresseeId !== me || friendship.status !== "pending") {
    conflict("friend_request_not_pending");
  }
  await participantRepo.acceptFriendRequest(friendshipId);
  res.json({ ok: true });
}));

router.post("/friends/requests/:id/decline", requireAuth, asyncHandler(async (req, res) => {
  const friendshipId = Number(req.params.id);
  const me = req.session!.userId!;
  const friendship = await getFriendshipForUserOr404(friendshipId, me);
  if (friendship.addresseeId !== me || friendship.status !== "pending") {
    conflict("friend_request_not_pending");
  }
  await participantRepo.declineFriendRequest(friendshipId);
  res.json({ ok: true });
}));

router.delete("/friends/:id", requireAuth, asyncHandler(async (req, res) => {
  const friendshipId = Number(req.params.id);
  const me = req.session!.userId!;
  await getFriendshipForUserOr404(friendshipId, me);
  await participantRepo.removeFriend(friendshipId);
  res.status(204).send();
}));

router.get("/pending-requests/all", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId;
  if (!userId) return res.json([]);
  const all = await participantRepo.getAllPendingRequestsForCreator(userId);
  res.json(all);
}));

router.get("/users/search", requireAuth, usersSearchLimiter, asyncHandler(async (req, res) => {
  const reqId = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  const userId = req.session?.userId;

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
        avatarAssetId: users.avatarAssetId,
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
        avatarUrl: resolveUserAvatarUrl(u),
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

router.get("/users/:username", requireAuth, asyncHandler(async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  if (!username) badRequest("Username required");
  const profile = await userRepo.getPublicProfileWithStats(username);
  if (!profile) notFound("User not found");
  res.json(profile);
}));

export default router;
