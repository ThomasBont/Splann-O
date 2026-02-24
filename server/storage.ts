import { db } from "./db";
import {
  users,
  barbecues,
  participants,
  expenses,
  expenseShares,
  notes,
  passwordResetTokens,
  friendships,
  eventNotifications,
  type User,
  type Barbecue,
  type Participant,
  type Expense,
  type InsertUser,
  type InsertBarbecue,
  type InsertParticipant,
  type InsertExpense,
  type InsertNote,
  type ExpenseWithParticipant,
  type NoteWithAuthor,
  type Membership,
  type PasswordResetToken,
  type FriendInfo,
  type PendingRequestWithBbq,
} from "@shared/schema";
import { eq, and, or, ne, inArray, desc } from "drizzle-orm";
import crypto from "crypto";

export interface IStorage {
  createUser(u: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUserPassword(id: number, passwordHash: string): Promise<void>;
  updateUserProfile(userId: number, updates: { displayName?: string; avatarUrl?: string | null; profileImageUrl?: string | null; bio?: string | null; preferredCurrencyCodes?: string | null }): Promise<User | undefined>;
  updateUserPlan(userId: number, plan: "free" | "pro", planExpiresAt?: Date | null): Promise<User | undefined>;
  deleteUser(userId: number): Promise<void>;

  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markTokenUsed(id: number): Promise<void>;

  getBarbecues(currentUsername?: string): Promise<Barbecue[]>;
  getBarbecue(id: number): Promise<Barbecue | undefined>;
  countBarbecuesByCreator(username: string): Promise<number>;
  getBarbecueByInviteToken(token: string): Promise<Barbecue | undefined>;
  createBarbecue(b: InsertBarbecue): Promise<Barbecue>;
  ensureBarbecueInviteToken(id: number): Promise<Barbecue | undefined>;
  updateBarbecue(id: number, updates: { allowOptInExpenses?: boolean; templateData?: unknown; status?: string; settledAt?: Date | null }): Promise<Barbecue | undefined>;
  createEventNotification(userId: string, barbecueId: number, type: string, payload?: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string }): Promise<unknown>;
  getEventNotificationsForUser(userId: string): Promise<{ id: number; barbecueId: number; type: string; payload: unknown; createdAt: Date | null }[]>;
  markEventNotificationRead(id: number): Promise<void>;
  deleteBarbecue(id: number): Promise<void>;

  getParticipants(bbqId: number): Promise<Participant[]>;
  getPendingRequests(bbqId: number): Promise<Participant[]>;
  getInvitedParticipants(bbqId: number): Promise<Participant[]>;
  getParticipant(id: number): Promise<Participant | undefined>;
  createParticipant(p: InsertParticipant): Promise<Participant>;
  joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant>;
  inviteParticipant(bbqId: number, name: string, userId: string): Promise<Participant>;
  acceptParticipant(id: number): Promise<Participant | undefined>;
  updateParticipantName(id: number, name: string): Promise<Participant | undefined>;
  deleteParticipant(id: number): Promise<void>;
  getMemberships(userId: string): Promise<Membership[]>;

  getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]>;
  createExpense(e: InsertExpense): Promise<Expense>;
  updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<void>;
  getExpenseShares(bbqId: number): Promise<{ expenseId: number; participantId: number }[]>;
  setExpenseShare(expenseId: number, participantId: number, inShare: boolean): Promise<void>;

  getNotes(bbqId: number): Promise<NoteWithAuthor[]>;
  createNote(n: InsertNote): Promise<NoteWithAuthor>;
  updateNote(id: number, updates: { title?: string | null; body?: string; pinned?: boolean }): Promise<NoteWithAuthor | undefined>;
  deleteNote(id: number): Promise<void>;

  sendFriendRequest(requesterId: number, addresseeId: number): Promise<void>;
  acceptFriendRequest(friendshipId: number): Promise<void>;
  declineFriendRequest(friendshipId: number): Promise<void>;
  removeFriend(friendshipId: number): Promise<void>;
  getFriends(userId: number): Promise<FriendInfo[]>;
  getFriendRequests(userId: number): Promise<FriendInfo[]>;
  getSentFriendRequests(userId: number): Promise<FriendInfo[]>;

  getAllPendingRequestsForCreator(username: string): Promise<PendingRequestWithBbq[]>;
}

export class DatabaseStorage implements IStorage {
  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return u;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  /** Public profile + stats for viewing other users. No email/preferredCurrencies. */
  async getPublicProfileWithStats(username: string): Promise<{ user: Pick<User, "id" | "username" | "displayName" | "profileImageUrl" | "avatarUrl" | "bio">; stats: { eventsCount: number; friendsCount: number; totalSpent: number } } | undefined> {
    const u = await this.getUserByUsername(username);
    if (!u) return undefined;
    const userId = u.id;

    const createdIds = (await db.select({ id: barbecues.id }).from(barbecues).where(eq(barbecues.creatorId, username))).map(r => r.id);
    const participatedIds = (await db.select({ barbecueId: participants.barbecueId }).from(participants).where(eq(participants.userId, username))).map(r => r.barbecueId);
    const eventsCount = new Set([...createdIds, ...participatedIds]).size;

    const friendRows = await db.select().from(friendships).where(and(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)), eq(friendships.status, "accepted")));
    const friendsCount = friendRows.length;

    const spentRows = await db.select({ amount: expenses.amount }).from(expenses).innerJoin(participants, eq(expenses.participantId, participants.id)).where(eq(participants.userId, username));
    const totalSpent = spentRows.reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);

    return {
      user: { id: u.id, username: u.username, displayName: u.displayName, profileImageUrl: u.profileImageUrl, avatarUrl: u.avatarUrl, bio: u.bio },
      stats: { eventsCount, friendsCount, totalSpent },
    };
  }

  async updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async updateUserProfile(userId: number, updates: { displayName?: string; avatarUrl?: string | null; profileImageUrl?: string | null; bio?: string | null; preferredCurrencyCodes?: string | null }): Promise<User | undefined> {
    const set: Record<string, unknown> = {};
    if (updates.displayName !== undefined) set.displayName = updates.displayName;
    if (updates.avatarUrl !== undefined) set.avatarUrl = updates.avatarUrl;
    if (updates.profileImageUrl !== undefined) set.profileImageUrl = updates.profileImageUrl;
    if (updates.bio !== undefined) set.bio = updates.bio;
    if (updates.preferredCurrencyCodes !== undefined) set.preferredCurrencyCodes = updates.preferredCurrencyCodes == null ? null : JSON.stringify(updates.preferredCurrencyCodes);
    if (Object.keys(set).length === 0) return this.getUserById(userId);
    const [u] = await db.update(users).set(set as any).where(eq(users.id, userId)).returning();
    return u;
  }

  async updateUserPlan(userId: number, plan: "free" | "pro", planExpiresAt?: Date | null): Promise<User | undefined> {
    const [u] = await db
      .update(users)
      .set({ plan, planExpiresAt: planExpiresAt ?? null })
      .where(eq(users.id, userId))
      .returning();
    return u;
  }

  async deleteUser(userId: number): Promise<void> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return;
    const username = u.username;
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
    await db.delete(barbecues).where(eq(barbecues.creatorId, username));
    await db.update(participants).set({ userId: null }).where(eq(participants.userId, username));
    await db.delete(users).where(eq(users.id, userId));
  }

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [row] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return row;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row;
  }

  async markTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async getBarbecues(currentUsername?: string): Promise<Barbecue[]> {
    const all = await db.select().from(barbecues);
    if (!currentUsername) return all.filter(b => b.isPublic);

    const userParticipations = await db.select({ bbqId: participants.barbecueId })
      .from(participants)
      .where(eq(participants.userId, currentUsername));
    const participatingIds = new Set(userParticipations.map(p => p.bbqId));

    return all.filter(b => {
      if (b.creatorId === currentUsername) return true;
      if (participatingIds.has(b.id)) return true;
      return false;
    });
  }

  async getBarbecue(id: number): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.id, id));
    return b;
  }

  async countBarbecuesByCreator(username: string): Promise<number> {
    const rows = await db.select({ id: barbecues.id }).from(barbecues).where(eq(barbecues.creatorId, username));
    return rows.length;
  }

  async getBarbecueByInviteToken(token: string): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.inviteToken, token));
    return b;
  }

  async createBarbecue(b: InsertBarbecue): Promise<Barbecue> {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const [bbq] = await db.insert(barbecues).values({ ...b, inviteToken }).returning();
    return bbq;
  }

  async ensureBarbecueInviteToken(id: number): Promise<Barbecue | undefined> {
    const [existing] = await db.select().from(barbecues).where(eq(barbecues.id, id));
    if (!existing) return undefined;
    if (existing.inviteToken) return existing;
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const [updated] = await db.update(barbecues).set({ inviteToken }).where(eq(barbecues.id, id)).returning();
    return updated;
  }

  async updateBarbecue(id: number, updates: { allowOptInExpenses?: boolean; templateData?: unknown; status?: string; settledAt?: Date | null }): Promise<Barbecue | undefined> {
    const set: Record<string, unknown> = {};
    if (updates.allowOptInExpenses !== undefined) set.allowOptInExpenses = updates.allowOptInExpenses;
    if (updates.templateData !== undefined) set.templateData = updates.templateData;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.settledAt !== undefined) set.settledAt = updates.settledAt;
    if (Object.keys(set).length === 0) return this.getBarbecue(id);
    const [b] = await db.update(barbecues).set(set as any).where(eq(barbecues.id, id)).returning();
    return b;
  }

  async createEventNotification(
    userId: string,
    barbecueId: number,
    type: string,
    payload?: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string }
  ): Promise<unknown> {
    const [row] = await db.insert(eventNotifications).values({ userId, barbecueId, type, payload: payload ?? null }).returning();
    return row;
  }

  async getEventNotificationsForUser(userId: string) {
    const rows = await db.select().from(eventNotifications).where(eq(eventNotifications.userId, userId)).orderBy(desc(eventNotifications.createdAt));
    return rows.map((r) => ({ id: r.id, barbecueId: r.barbecueId, type: r.type, payload: r.payload, createdAt: r.createdAt, readAt: r.readAt }));
  }

  async markEventNotificationRead(id: number): Promise<void> {
    await db.update(eventNotifications).set({ readAt: new Date() }).where(eq(eventNotifications.id, id));
  }

  async deleteBarbecue(id: number): Promise<void> {
    await db.delete(barbecues).where(eq(barbecues.id, id));
  }

  async getParticipants(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "accepted"))
    );
  }

  async getPendingRequests(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "pending"))
    );
  }

  async getInvitedParticipants(bbqId: number): Promise<Participant[]> {
    return await db.select().from(participants).where(
      and(eq(participants.barbecueId, bbqId), eq(participants.status, "invited"))
    );
  }

  async getParticipant(id: number): Promise<Participant | undefined> {
    const [p] = await db.select().from(participants).where(eq(participants.id, id));
    return p;
  }

  async createParticipant(p: InsertParticipant): Promise<Participant> {
    const [participant] = await db.insert(participants).values(p).returning();
    return participant;
  }

  async joinBarbecue(bbqId: number, name: string, userId: string): Promise<Participant> {
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "pending" }).returning();
    return p;
  }

  async inviteParticipant(bbqId: number, name: string, userId: string): Promise<Participant> {
    const [p] = await db.insert(participants).values({ barbecueId: bbqId, name, userId, status: "invited" }).returning();
    return p;
  }

  async acceptParticipant(id: number): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ status: "accepted" }).where(eq(participants.id, id)).returning();
    return updated;
  }

  async updateParticipantName(id: number, name: string): Promise<Participant | undefined> {
    const [updated] = await db.update(participants).set({ name }).where(eq(participants.id, id)).returning();
    return updated;
  }

  async deleteParticipant(id: number): Promise<void> {
    await db.delete(participants).where(eq(participants.id, id));
  }

  async getMemberships(userId: string): Promise<Membership[]> {
    const rows = await db.select().from(participants).where(eq(participants.userId, userId));
    return rows.map(p => ({ bbqId: p.barbecueId, participantId: p.id, status: p.status, name: p.name }));
  }

  async getExpenses(bbqId: number): Promise<ExpenseWithParticipant[]> {
    const allExpenses = await db.select().from(expenses).where(eq(expenses.barbecueId, bbqId));
    const allParticipants = await this.getParticipants(bbqId);
    return allExpenses.map(e => {
      const p = allParticipants.find(p => p.id === e.participantId);
      return { ...e, participantName: p ? p.name : 'Unknown', participantUserId: p?.userId ?? null };
    });
  }

  async createExpense(e: InsertExpense, options?: { optInByDefault?: boolean }): Promise<Expense> {
    const [expense] = await db.insert(expenses).values({ ...e, amount: e.amount.toString() }).returning();
    const bbq = await this.getBarbecue(e.barbecueId);
    if (bbq?.allowOptInExpenses && options?.optInByDefault !== true) {
      const accepted = await this.getParticipants(e.barbecueId);
      if (accepted.length > 0) {
        await db.insert(expenseShares).values(accepted.map(p => ({ expenseId: expense.id, participantId: p.id })));
      }
    }
    return expense;
  }

  async updateExpense(id: number, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const updateData: Record<string, any> = { ...updates };
    if (updateData.amount !== undefined) updateData.amount = String(updateData.amount);
    const [updated] = await db.update(expenses).set(updateData as any).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getExpenseShares(bbqId: number): Promise<{ expenseId: number; participantId: number }[]> {
    const exps = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.barbecueId, bbqId));
    if (exps.length === 0) return [];
    const rows = await db.select().from(expenseShares).where(inArray(expenseShares.expenseId, exps.map(x => x.id)));
    return rows.map(r => ({ expenseId: r.expenseId, participantId: r.participantId }));
  }

  async setExpenseShare(expenseId: number, participantId: number, inShare: boolean): Promise<void> {
    if (inShare) {
      await db.insert(expenseShares).values({ expenseId, participantId }).onConflictDoNothing({ target: [expenseShares.expenseId, expenseShares.participantId] });
    } else {
      await db.delete(expenseShares).where(and(eq(expenseShares.expenseId, expenseId), eq(expenseShares.participantId, participantId)));
    }
  }

  async getNotes(bbqId: number): Promise<NoteWithAuthor[]> {
    const rows = await db.select().from(notes).where(eq(notes.barbecueId, bbqId)).orderBy(desc(notes.createdAt));
    const participantsList = await this.getParticipants(bbqId);
    return rows.map((n) => {
      const p = participantsList.find((x) => x.id === n.participantId);
      return { ...n, authorName: p ? p.name : "Unknown" };
    });
  }

  async createNote(n: InsertNote): Promise<NoteWithAuthor> {
    const [row] = await db.insert(notes).values({ ...n, updatedAt: new Date() }).returning();
    const p = await this.getParticipant(row.participantId);
    return { ...row, authorName: p ? p.name : "Unknown" };
  }

  async updateNote(id: number, updates: { title?: string | null; body?: string; pinned?: boolean }): Promise<NoteWithAuthor | undefined> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.title !== undefined) set.title = updates.title;
    if (updates.body !== undefined) set.body = updates.body;
    if (updates.pinned !== undefined) set.pinned = updates.pinned;
    const [row] = await db.update(notes).set(set as any).where(eq(notes.id, id)).returning();
    if (!row) return undefined;
    const p = await this.getParticipant(row.participantId);
    return { ...row, authorName: p ? p.name : "Unknown" };
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  async sendFriendRequest(requesterId: number, addresseeId: number): Promise<void> {
    const existing = await db.select().from(friendships).where(
      or(
        and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId)),
        and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, requesterId))
      )
    );
    if (existing.length > 0) throw new Error("friendship_exists");
    await db.insert(friendships).values({ requesterId, addresseeId, status: "pending" });
  }

  async acceptFriendRequest(friendshipId: number): Promise<void> {
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, friendshipId));
  }

  async declineFriendRequest(friendshipId: number): Promise<void> {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }

  async removeFriend(friendshipId: number): Promise<void> {
    await db.delete(friendships).where(eq(friendships.id, friendshipId));
  }

  async getFriends(userId: number): Promise<FriendInfo[]> {
    const rows = await db.select().from(friendships).where(
      and(
        or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
        eq(friendships.status, "accepted")
      )
    );
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const friendUserId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      const user = await this.getUserById(friendUserId);
      if (user) {
        result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "accepted" });
      }
    }
    return result;
  }

  async getFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db.select().from(friendships).where(
      and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending"))
    );
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const user = await this.getUserById(row.requesterId);
      if (user) {
        result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "pending" });
      }
    }
    return result;
  }

  async getSentFriendRequests(userId: number): Promise<FriendInfo[]> {
    const rows = await db.select().from(friendships).where(
      and(eq(friendships.requesterId, userId), eq(friendships.status, "pending"))
    );
    const result: FriendInfo[] = [];
    for (const row of rows) {
      const user = await this.getUserById(row.addresseeId);
      if (user) {
        result.push({ friendshipId: row.id, userId: user.id, username: user.username, displayName: user.displayName, status: "pending" });
      }
    }
    return result;
  }

  async getAllPendingRequestsForCreator(username: string): Promise<PendingRequestWithBbq[]> {
    const creatorBbqs = await db.select().from(barbecues).where(eq(barbecues.creatorId, username));
    const result: PendingRequestWithBbq[] = [];
    for (const bbq of creatorBbqs) {
      const pending = await this.getPendingRequests(bbq.id);
      for (const p of pending) {
        result.push({ ...p, bbqName: bbq.name });
      }
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
