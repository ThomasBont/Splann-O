import { db } from "../db";
import { participants, friendships, barbecues, users } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import type { Participant, InsertParticipant } from "@shared/schema";
import type { Membership } from "@shared/schema";
import type { FriendInfo, PendingRequestWithBbq } from "@shared/schema";

export const participantRepo = {
  async listByBbq(bbqId: number, status: "accepted" | "pending" | "invited"): Promise<Participant[]> {
    return db.select().from(participants).where(and(eq(participants.barbecueId, bbqId), eq(participants.status, status)));
  },

  async countByBbq(bbqId: number): Promise<number> {
    const rows = await db.select({ id: participants.id }).from(participants).where(eq(participants.barbecueId, bbqId));
    return rows.length;
  },

  async getById(id: number): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.id, id));
    return p;
  },

  async getBarbecueByToken(token: string) {
    const [bbq] = await db.select().from(barbecues).where(eq(barbecues.inviteToken, token));
    return bbq;
  },

  async create(p: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  },

  async joinBarbecue(bbqId: number, name: string, userId: number): Promise<Participant> {
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "pending" }).returning();
    return p;
  },

  async inviteUser(bbqId: number, username: string, userId?: number | null): Promise<Participant> {
    const [p] = await db
      .insert(participants)
      .values({ barbecueId: bbqId, name: username, userId: userId ?? null, status: "invited" })
      .returning();
    return p;
  },

  async accept(id: number): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ status: "accepted" }).where(eq(participants.id, id)).returning();
    return updated;
  },

  async updateName(id: number, name: string): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ name }).where(eq(participants.id, id)).returning();
    return updated;
  },

  async delete(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  },

  async getMemberships(userId: number): Promise<Membership[]> {
    const rows = await db.select().from(participants).where(eq(participants.userId, userId));
    return rows.map((p) => ({ bbqId: p.barbecueId, participantId: p.id, status: p.status, name: p.name }));
  },

  async sendFriendRequest(requesterId: number, addresseeId: number): Promise<void> {
    const existing = await db.select().from(friendships).where(
      or(
        and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId)),
        and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, requesterId))
      )
    );
    if (existing.length > 0) throw new Error("friendship_exists");
    await db.insert(friendships).values({ requesterId, addresseeId, status: "pending" });
  },

  async acceptFriendRequest(friendshipId: number): Promise<void> {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, friendshipId));
  },

  async declineFriendRequest(friendshipId: number): Promise<void> {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  },

  async removeFriend(friendshipId: number): Promise<void> {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  },

  async getFriends(userId: number): Promise<FriendInfo[]> {
    const rows = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(friendships)
      .innerJoin(
        users,
        or(
          and(eq(friendships.requesterId, userId), eq(users.id, friendships.addresseeId)),
          and(eq(friendships.addresseeId, userId), eq(users.id, friendships.requesterId)),
        ),
      )
      .where(and(
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
        eq(friendships.status, "accepted"),
      ));

    return rows.map((row) => ({
      friendshipId: row.friendshipId,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      status: "accepted",
    }));
  },

  async getFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.requesterId))
      .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")));
    return rows.map((row) => ({
      friendshipId: row.friendshipId,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      status: "pending",
    }));
  },

  async getSentFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        displayName: users.displayName,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.addresseeId))
      .where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")));
    return rows.map((row) => ({
      friendshipId: row.friendshipId,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      status: "pending",
    }));
  },

  async getAllPendingRequestsForCreator(creatorUserId: number): Promise<PendingRequestWithBbq[]> {
    const rows = await db
      .select({
        participantId: participants.id,
        participantName: participants.name,
        participantUserId: participants.userId,
        participantStatus: participants.status,
        participantCreatedAt: participants.createdAt,
        bbqId: barbecues.id,
        bbqName: barbecues.name,
      })
      .from(participants)
      .innerJoin(barbecues, eq(participants.barbecueId, barbecues.id))
      .where(and(
        eq(barbecues.creatorUserId, creatorUserId),
        eq(participants.status, "pending"),
      ));
    return rows.map((row) => ({
      id: row.participantId,
      name: row.participantName,
      userId: row.participantUserId,
      status: row.participantStatus,
      createdAt: row.participantCreatedAt,
      barbecueId: row.bbqId,
      bbqName: row.bbqName,
    }));
  },
};
