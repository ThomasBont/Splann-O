import { db } from "../db";
import { users, barbecues, participants, expenses, passwordResetTokens, friendships } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";
import type { User, InsertUser, PasswordResetToken } from "@shared/schema";

export const userRepo = {
  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  },

  async findByUsername(username: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return u;
  },

  async findById(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  },

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  },

  async updateProfile(
    userId: number,
    updates: {
      displayName?: string;
      avatarUrl?: string | null;
      profileImageUrl?: string | null;
      bio?: string | null;
      preferredCurrencyCodes?: string | null;
      defaultCurrencyCode?: string | null;
      favoriteCurrencyCodes?: string[] | null;
    }
  ): Promise<User | undefined> {
    const set: Record<string, unknown> = {};
    if (updates.displayName !== undefined) set.displayName = updates.displayName;
    if (updates.avatarUrl !== undefined) set.avatarUrl = updates.avatarUrl;
    if (updates.profileImageUrl !== undefined) set.profileImageUrl = updates.profileImageUrl;
    if (updates.bio !== undefined) set.bio = updates.bio;
    if (updates.preferredCurrencyCodes !== undefined)
      set.preferredCurrencyCodes = updates.preferredCurrencyCodes == null ? null : JSON.stringify(updates.preferredCurrencyCodes);
    if (updates.defaultCurrencyCode !== undefined) set.defaultCurrencyCode = updates.defaultCurrencyCode;
    if (updates.favoriteCurrencyCodes !== undefined) set.favoriteCurrencyCodes = updates.favoriteCurrencyCodes ?? [];
    if (Object.keys(set).length === 0) return this.findById(userId);
    const [u] = await db.update(users).set(set as Record<string, unknown>).where(eq(users.id, userId)).returning();
    return u;
  },

  async updatePlan(userId: number, plan: "free" | "pro", planExpiresAt?: Date | null): Promise<User | undefined> {
    const [u] = await db.update(users).set({ plan, planExpiresAt: planExpiresAt ?? null }).where(eq(users.id, userId)).returning();
    return u;
  },

  async deleteUser(userId: number): Promise<void> {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    if (!u) return;
    const username = u.username;
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
    await db.delete(barbecues).where(eq(barbecues.creatorId, username));
    await db.update(participants).set({ userId: null }).where(eq(participants.userId, username));
    await db.delete(users).where(eq(users.id, userId));
  },

  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [row] = await db.insert(passwordResetTokens).values({ userId, token, expiresAt }).returning();
    return row;
  },

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return row;
  },

  async markTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  },

  async setEmailVerifyToken(userId: number, hashedToken: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerifyToken: hashedToken,
        emailVerifyTokenExpiresAt: expiresAt,
      })
      .where(eq(users.id, userId));
  },

  async findByEmailVerifyToken(hashedToken: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerifyToken, hashedToken));
    if (!user || !user.emailVerifyTokenExpiresAt || new Date() > user.emailVerifyTokenExpiresAt) return undefined;
    return user;
  },

  async verifyEmailAndClearToken(userId: number): Promise<User | undefined> {
    const [u] = await db
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        emailVerifyToken: null,
        emailVerifyTokenExpiresAt: null,
      })
      .where(eq(users.id, userId))
      .returning();
    return u;
  },

  async getPublicProfileWithStats(username: string): Promise<
    | { user: Pick<User, "id" | "username" | "displayName" | "profileImageUrl" | "avatarUrl" | "bio">; stats: { eventsCount: number; friendsCount: number; totalSpent: number } }
    | undefined
  > {
    const u = await this.findByUsername(username);
    if (!u) return undefined;
    const userId = u.id;
    const createdIds = (await db.select({ id: barbecues.id }).from(barbecues).where(eq(barbecues.creatorId, username))).map((r) => r.id);
    const participatedIds = (await db.select({ barbecueId: participants.barbecueId }).from(participants).where(eq(participants.userId, username))).map((r) => r.barbecueId);
    const eventsCount = new Set([...createdIds, ...participatedIds]).size;
    const friendRows = await db.select().from(friendships).where(and(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)), eq(friendships.status, "accepted")));
    const friendsCount = friendRows.length;
    const spentRows = await db
      .select({ amount: expenses.amount })
      .from(expenses)
      .innerJoin(participants, eq(expenses.participantId, participants.id))
      .where(eq(participants.userId, username));
    const totalSpent = spentRows.reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
    return {
      user: { id: u.id, username: u.username, displayName: u.displayName, profileImageUrl: u.profileImageUrl, avatarUrl: u.avatarUrl, bio: u.bio },
      stats: { eventsCount, friendsCount, totalSpent },
    };
  },
};
