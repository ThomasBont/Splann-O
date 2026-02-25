import { db } from "../db";
import { participants, friendships, barbecues } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import type { Participant, InsertParticipant } from "@shared/schema";
import type { Membership } from "@shared/schema";
import type { FriendInfo, PendingRequestWithBbq } from "@shared/schema";
import { userRepo } from "./userRepo";

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

  async create(p: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  },

  async joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant> {
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "pending" }).returning();
    return p;
  },

  async inviteUser(bbqId: number, username: string, invitedUserId?: number | null): Promise<Participant> {
    const [p] = await db
      .insert(participants)
      .values({ barbecueId: bbqId, name: username, userId: username, invitedUserId: invitedUserId ?? null, status: "invited" })
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

  async getMemberships(userId: string): Promise<Membership[]> {
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
      .select()
      .from(friendships)
      .where(and(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)), eq(friendships.status, "accepted")));
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const friendUserId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      const user = await userRepo.findById(friendUserId);
      if (user) result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "accepted" });
    }
    return result;
  },

  async getFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db.select().from(friendships).where(and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending")));
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const user = await userRepo.findById(row.requesterId);
      if (user) result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "pending" });
    }
    return result;
  },

  async getSentFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db.select().from(friendships).where(and(eq(friendships.requesterId, userId), eq(friendships.status, "pending")));
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const user = await userRepo.findById(row.addresseeId);
      if (user) result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "pending" });
    }
    return result;
  },

  async getAllPendingRequestsForCreator(username: string): Promise<PendingRequestWithBbq[]> {
    const creatorBbqs = await db.select().from(barbecues).where(eq(barbecues.creatorId, username));
    const result: PendingRequestWithBbq[] = [];
    for (const bbq of creatorBbqs) {
      const pending = await this.listByBbq(bbq.id, "pending");
      for (const p of pending) result.push({ ...p, bbqName: bbq.name });
    }
    return result;
  },
};
