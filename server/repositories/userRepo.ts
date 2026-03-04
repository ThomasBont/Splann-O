import { db } from "../db";
import { users, barbecues, participants, expenses, passwordResetTokens, friendships } from "@shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { isPublicListingActive } from "../lib/public-listing";
import type { User, InsertUser, PasswordResetToken } from "@shared/schema";
import { resolveLegacyAssetIdToPublicPath } from "../lib/assets";

function resolveAvatarUrl(user: { avatarUrl?: string | null; profileImageUrl?: string | null; avatarAssetId?: string | null }): string | null {
  if (user.avatarUrl) return user.avatarUrl;
  if (user.profileImageUrl) return user.profileImageUrl;
  if (user.avatarAssetId) return resolveLegacyAssetIdToPublicPath(user.avatarAssetId);
  return null;
}

export const userRepo = {
  async createUser(u: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(u).returning();
    return user;
  },

  async findByUsername(username: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  },

  async findByPublicHandle(handle: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.publicHandle, handle));
    return u;
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return u;
  },

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.googleId, googleId));
    return u;
  },

  async findById(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  },

  async linkGoogleId(id: number, googleId: string): Promise<User | undefined> {
    const [u] = await db.update(users).set({ googleId }).where(eq(users.id, id)).returning();
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
      avatarAssetId?: string | null;
      profileImageUrl?: string | null;
      bio?: string | null;
      publicHandle?: string | null;
      publicProfileEnabled?: boolean;
      defaultEventType?: "private" | "public" | null;
      preferredCurrencyCodes?: string | null;
      defaultCurrencyCode?: string | null;
      favoriteCurrencyCodes?: string[] | null;
    }
  ): Promise<User | undefined> {
    const set: Record<string, unknown> = {};
    if (updates.displayName !== undefined) set.displayName = updates.displayName;
    if (updates.avatarUrl !== undefined) set.avatarUrl = updates.avatarUrl;
    if (updates.avatarAssetId !== undefined) set.avatarAssetId = updates.avatarAssetId;
    if (updates.profileImageUrl !== undefined) set.profileImageUrl = updates.profileImageUrl;
    if (updates.bio !== undefined) set.bio = updates.bio;
    if (updates.publicHandle !== undefined) set.publicHandle = updates.publicHandle;
    if (updates.publicProfileEnabled !== undefined) set.publicProfileEnabled = updates.publicProfileEnabled;
    if (updates.defaultEventType !== undefined) set.defaultEventType = updates.defaultEventType ?? "private";
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
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await db.delete(friendships).where(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)));
    await db.delete(barbecues).where(eq(barbecues.creatorUserId, userId));
    await db.update(participants).set({ userId: null }).where(eq(participants.userId, userId));
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
    const createdIds = (await db.select({ id: barbecues.id }).from(barbecues).where(eq(barbecues.creatorUserId, userId))).map((r) => r.id);
    const participatedIds = (await db.select({ barbecueId: participants.barbecueId }).from(participants).where(eq(participants.userId, userId))).map((r) => r.barbecueId);
    const eventsCount = new Set([...createdIds, ...participatedIds]).size;
    const friendRows = await db.select().from(friendships).where(and(or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)), eq(friendships.status, "accepted")));
    const friendsCount = friendRows.length;
    const spentRows = await db
      .select({ amount: expenses.amount })
      .from(expenses)
      .innerJoin(participants, eq(expenses.participantId, participants.id))
      .where(eq(participants.userId, userId));
    const totalSpent = spentRows.reduce((s, r) => s + parseFloat(String(r.amount || 0)), 0);
    return {
      user: {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        profileImageUrl: u.profileImageUrl ?? resolveAvatarUrl(u),
        avatarUrl: resolveAvatarUrl(u),
        bio: u.bio,
      },
      stats: { eventsCount, friendsCount, totalSpent },
    };
  },

  async getShareablePublicProfile(handleOrUsername: string, viewerUsername?: string): Promise<
    | {
        profile: {
          id: number;
          username: string;
          handle: string;
          displayName: string | null;
          profileImageUrl: string | null;
          avatarUrl: string | null;
          bio: string | null;
          createdAt: Date | null;
        };
        viewerIsOwner: boolean;
        stats: {
          publicEventsHosted: number;
          totalAttendees: number;
          ratioLabel: "Mostly private" | "Balanced" | "Mostly public" | null;
        };
        events: Array<{
          id: number;
          title: string;
          date: string | null;
          locationName: string | null;
          city: string | null;
          countryName: string | null;
          publicSlug: string;
          publicMode: "marketing" | "joinable";
          attendeeCount: number;
          bannerImageUrl: string | null;
          themeCategory: "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other";
        }>;
      }
    | undefined
  > {
    const user = (await this.findByPublicHandle(handleOrUsername)) ?? (await this.findByUsername(handleOrUsername));
    if (!user) return undefined;
    const viewerIsOwner = !!viewerUsername && viewerUsername === user.username;
    if (!viewerIsOwner && user.publicProfileEnabled === false) return undefined;

    const ownedEvents = await db.select().from(barbecues).where(eq(barbecues.creatorUserId, user.id));
    const visiblePublicEvents = ownedEvents
      .filter((e) => e.visibility === "public")
      .filter((e) => e.status !== "draft")
      .filter((e) => !!e.publicSlug)
      .filter((e) => isPublicListingActive(e))
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return aTime - bTime;
      });

    const publicEventIds = visiblePublicEvents.map((e) => e.id);
    const participantRows = publicEventIds.length
      ? await db
          .select({ barbecueId: participants.barbecueId, status: participants.status })
          .from(participants)
          .where(inArray(participants.barbecueId, publicEventIds))
      : [];
    const attendeeCountByEventId = new Map<number, number>();
    for (const row of participantRows) {
      if (row.status !== "accepted") continue;
      attendeeCountByEventId.set(row.barbecueId, (attendeeCountByEventId.get(row.barbecueId) ?? 0) + 1);
    }

    const totalOwned = ownedEvents.length;
    const publicOwned = ownedEvents.filter((e) => e.visibility === "public").length;
    const privateOwned = Math.max(0, totalOwned - publicOwned);
    const ratio = totalOwned > 0 ? publicOwned / totalOwned : 0;
    const ratioLabel: "Mostly private" | "Balanced" | "Mostly public" | null =
      totalOwned === 0
        ? null
        : ratio >= 0.66
          ? "Mostly public"
          : ratio <= 0.33
            ? "Mostly private"
            : "Balanced";

    const mapThemeCategory = (event: (typeof ownedEvents)[number]) => {
      const tpl = (event.templateData && typeof event.templateData === "object") ? event.templateData as Record<string, unknown> : null;
      const rawCategory = typeof tpl?.publicCategory === "string" ? tpl.publicCategory.toLowerCase() : "";
      if (rawCategory === "party" || rawCategory === "networking" || rawCategory === "meetup" || rawCategory === "workshop" || rawCategory === "conference" || rawCategory === "training" || rawCategory === "sports" || rawCategory === "other") {
        return rawCategory;
      }
      if (String(event.eventType ?? "").includes("party") || String(event.eventType ?? "") === "barbecue") return "party";
      if (String(event.eventType ?? "").includes("trip")) return "meetup";
      return "other";
    };

    return {
      profile: {
        id: user.id,
        username: user.username,
        handle: user.publicHandle ?? user.username,
        displayName: user.displayName ?? null,
        profileImageUrl: user.profileImageUrl ?? null,
        avatarUrl: resolveAvatarUrl(user),
        bio: user.bio ?? null,
        createdAt: user.createdAt ?? null,
      },
      viewerIsOwner,
      stats: {
        publicEventsHosted: visiblePublicEvents.length,
        totalAttendees: visiblePublicEvents.reduce((sum, e) => sum + (attendeeCountByEventId.get(e.id) ?? 0), 0),
        ratioLabel: viewerIsOwner ? ratioLabel : null,
      },
      events: visiblePublicEvents.map((e) => ({
        id: e.id,
        title: e.name,
        date: e.date ? e.date.toISOString() : null,
        locationName: e.locationName ?? null,
        city: e.city ?? null,
        countryName: e.countryName ?? null,
        publicSlug: e.publicSlug ?? "",
        publicMode: (e.publicMode as "marketing" | "joinable") ?? "marketing",
        attendeeCount: attendeeCountByEventId.get(e.id) ?? 0,
        bannerImageUrl: e.bannerImageUrl ?? null,
        themeCategory: mapThemeCategory(e) as "party" | "networking" | "meetup" | "workshop" | "conference" | "training" | "sports" | "other",
      })),
    };
  },
};
