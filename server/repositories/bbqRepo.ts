import crypto from "crypto";
import { db } from "../db";
import { barbecues, participants, eventMembers, eventNotifications, publicEventRsvps } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { desc } from "drizzle-orm";
import type { Barbecue } from "@shared/schema";

export const bbqRepo = {
  async listAccessible(currentUsername?: string, currentUserId?: number): Promise<Barbecue[]> {
    const all = await db.select().from(barbecues);
    if (!currentUserId) return all.filter((b) => b.isPublic);

    const participatingByUserId = await db.select({ bbqId: participants.barbecueId }).from(participants).where(eq(participants.userId, currentUserId));
    const participatingIds = new Set(participatingByUserId.map((p) => p.bbqId));
    const byEventMember = await db.select({ bbqId: eventMembers.eventId }).from(eventMembers).where(eq(eventMembers.userId, currentUserId));
    byEventMember.forEach((p) => participatingIds.add(p.bbqId));

    return all.filter((b) => {
      if (b.isPublic) return true;
      if (b.creatorUserId === currentUserId) return true;
      if (participatingIds.has(b.id)) return true;
      return false;
    });
  },

  async listPublic(): Promise<Barbecue[]> {
    return db.select().from(barbecues).then((rows) => rows.filter((b) => b.isPublic));
  },

  async listExploreCandidates(): Promise<Barbecue[]> {
    return db
      .select()
      .from(barbecues)
      .where(eq(barbecues.visibility, "public"));
  },

  async getByPublicSlug(slug: string): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.publicSlug, slug));
    return b;
  },

  async getById(id: number): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.id, id));
    return b;
  },

  async hasAccess(bbq: Barbecue, currentUsername?: string, currentUserId?: number): Promise<boolean> {
    if (bbq.isPublic) return true;
    if (!currentUserId) return false;
    if (bbq.creatorUserId === currentUserId) return true;
    const byParticipant = await db.select({ id: participants.id }).from(participants).where(and(eq(participants.barbecueId, bbq.id), eq(participants.userId, currentUserId)));
    if (byParticipant.length > 0) return true;
    const byEventMember = await db.select({ id: eventMembers.id }).from(eventMembers).where(and(eq(eventMembers.eventId, bbq.id), eq(eventMembers.userId, currentUserId)));
    if (byEventMember.length > 0) return true;
    return false;
  },

  async countOwnedByCreatorUserId(userId: number): Promise<number> {
    const rows = await db.select({ id: barbecues.id }).from(barbecues).where(eq(barbecues.creatorUserId, userId));
    return rows.length;
  },

  async getByInviteToken(token: string): Promise<Barbecue | undefined> {
    const [b] = await db.select().from(barbecues).where(eq(barbecues.inviteToken, token));
    return b;
  },

  async create(b: typeof barbecues.$inferInsert): Promise<Barbecue> {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const [bbq] = await db.insert(barbecues).values({ ...b, inviteToken }).returning();
    return bbq;
  },

  async ensureInviteToken(id: number): Promise<Barbecue | undefined> {
    const [existing] = await db.select().from(barbecues).where(eq(barbecues.id, id));
    if (!existing) return undefined;
    if (existing.inviteToken) return existing;
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const [updated] = await db.update(barbecues).set({ inviteToken }).where(eq(barbecues.id, id)).returning();
    return updated;
  },

  async update(
    id: number,
    updates: {
      name?: string;
      date?: Date;
      allowOptInExpenses?: boolean;
      templateData?: unknown;
      status?: string;
      settledAt?: Date | null;
      locationName?: string | null;
      city?: string | null;
      countryCode?: string | null;
      countryName?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      placeId?: string | null;
      locationText?: string | null;
      locationMeta?: unknown | null;
      currency?: string;
      localCurrency?: string | null;
      currencySource?: "auto" | "manual";
      eventType?: string;
      eventVibe?: string;
      visibility?: "private" | "public";
      visibilityOrigin?: "private" | "public";
      publicMode?: "marketing" | "joinable";
      publicTemplate?: string;
      publicListingStatus?: "inactive" | "active" | "expired" | "paused";
      publicListFromAt?: Date | null;
      publicListUntilAt?: Date | null;
      publicListingExpiresAt?: Date | null;
      publicSlug?: string | null;
      organizationName?: string | null;
      publicDescription?: string | null;
      bannerImageUrl?: string | null;
      bannerAssetId?: string | null;
      updatedAt?: Date;
    }
  ): Promise<Barbecue | undefined> {
    const set: Record<string, unknown> = {};
    if (updates.name !== undefined) set.name = updates.name;
    if (updates.date !== undefined) set.date = updates.date;
    if (updates.allowOptInExpenses !== undefined) set.allowOptInExpenses = updates.allowOptInExpenses;
    if (updates.templateData !== undefined) set.templateData = updates.templateData;
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.settledAt !== undefined) set.settledAt = updates.settledAt;
    if (updates.locationName !== undefined) set.locationName = updates.locationName;
    if (updates.city !== undefined) set.city = updates.city;
    if (updates.countryCode !== undefined) set.countryCode = updates.countryCode;
    if (updates.countryName !== undefined) set.countryName = updates.countryName;
    if (updates.latitude !== undefined) set.latitude = updates.latitude;
    if (updates.longitude !== undefined) set.longitude = updates.longitude;
    if (updates.placeId !== undefined) set.placeId = updates.placeId;
    if (updates.locationText !== undefined) set.locationText = updates.locationText;
    if (updates.locationMeta !== undefined) set.locationMeta = updates.locationMeta;
    if (updates.currency !== undefined) set.currency = updates.currency;
    if (updates.localCurrency !== undefined) set.localCurrency = updates.localCurrency;
    if (updates.currencySource !== undefined) set.currencySource = updates.currencySource;
    if (updates.eventType !== undefined) set.eventType = updates.eventType;
    if (updates.eventVibe !== undefined) set.eventVibe = updates.eventVibe;
    if (updates.visibility !== undefined) {
      set.visibility = updates.visibility;
      set.isPublic = updates.visibility === "public";
    }
    if (updates.visibilityOrigin !== undefined) set.visibilityOrigin = updates.visibilityOrigin;
    if (updates.publicMode !== undefined) set.publicMode = updates.publicMode;
    if (updates.publicTemplate !== undefined) set.publicTemplate = updates.publicTemplate;
    if (updates.publicListingStatus !== undefined) set.publicListingStatus = updates.publicListingStatus;
    if (updates.publicListFromAt !== undefined) set.publicListFromAt = updates.publicListFromAt;
    if (updates.publicListUntilAt !== undefined) set.publicListUntilAt = updates.publicListUntilAt;
    if (updates.publicListingExpiresAt !== undefined) set.publicListingExpiresAt = updates.publicListingExpiresAt;
    if (updates.publicSlug !== undefined) set.publicSlug = updates.publicSlug;
    if (updates.organizationName !== undefined) set.organizationName = updates.organizationName;
    if (updates.publicDescription !== undefined) set.publicDescription = updates.publicDescription;
    if (updates.bannerImageUrl !== undefined) set.bannerImageUrl = updates.bannerImageUrl;
    if (updates.bannerAssetId !== undefined) set.bannerAssetId = updates.bannerAssetId;
    if (Object.keys(set).length > 0) set.updatedAt = updates.updatedAt ?? new Date();
    if (Object.keys(set).length === 0) return this.getById(id);
    const [b] = await db.update(barbecues).set(set as Record<string, unknown>).where(eq(barbecues.id, id)).returning();
    return b;
  },

  async delete(id: number): Promise<void> {
    await db.delete(barbecues).where(eq(barbecues.id, id));
  },

  async createEventNotification(
    userId: number,
    barbecueId: number,
    type: string,
    payload?: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string }
  ): Promise<unknown> {
    const [row] = await db.insert(eventNotifications).values({ userId, barbecueId, type, payload: payload ?? null }).returning();
    return row;
  },

  async createEventNotificationsBatch(
    items: { userId: number; barbecueId: number; type: string; payload?: { creatorName?: string; amountOwed?: number; eventName?: string; currency?: string } }[]
  ): Promise<void> {
    if (items.length === 0) return;
    await db.insert(eventNotifications).values(items.map((it) => ({ userId: it.userId, barbecueId: it.barbecueId, type: it.type, payload: it.payload ?? null })));
  },

  async getEventNotificationsForUser(userId: number): Promise<{ id: number; barbecueId: number; type: string; payload: unknown; createdAt: Date | null; readAt: Date | null }[]> {
    const rows = await db
      .select()
      .from(eventNotifications)
      .where(eq(eventNotifications.userId, userId))
      .orderBy(desc(eventNotifications.createdAt));
    return rows.map((r) => ({ id: r.id, barbecueId: r.barbecueId, type: r.type, payload: r.payload, createdAt: r.createdAt, readAt: r.readAt }));
  },

  async markEventNotificationRead(id: number): Promise<void> {
    await db.update(eventNotifications).set({ readAt: new Date() }).where(eq(eventNotifications.id, id));
  },

  async incrementPublicViewCount(id: number): Promise<void> {
    await db
      .update(barbecues)
      .set({ publicViewCount: sql`${barbecues.publicViewCount} + 1` })
      .where(eq(barbecues.id, id));
  },

  async listPublicRsvpRequests(eventId: number) {
    return db.select().from(publicEventRsvps).where(eq(publicEventRsvps.barbecueId, eventId)).orderBy(desc(publicEventRsvps.createdAt));
  },

  async updatePublicRsvpRequest(eventId: number, rsvpId: number, status: "approved" | "declined" | "requested" | "going") {
    const [updated] = await db
      .update(publicEventRsvps)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(publicEventRsvps.id, rsvpId), eq(publicEventRsvps.barbecueId, eventId)))
      .returning();
    return updated;
  },
};
