import crypto from "crypto";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { publicEventConversations, publicEventMessages, users, barbecues } from "@shared/schema";

export const publicInboxRepo = {
  async findConversationForParticipant(eventId: number, organizerUserId: number, participantUserId: number) {
    const [row] = await db.select().from(publicEventConversations).where(
      and(
        eq(publicEventConversations.barbecueId, eventId),
        eq(publicEventConversations.organizerUserId, organizerUserId),
        eq(publicEventConversations.participantUserId, participantUserId),
      ),
    );
    return row;
  },

  async createConversation(input: {
    eventId: number;
    organizerUserId: number;
    participantUserId: number | null;
    participantLabel?: string | null;
    participantEmail?: string | null;
    status?: "pending" | "active" | "archived" | "blocked";
  }) {
    const [row] = await db.insert(publicEventConversations).values({
      id: crypto.randomUUID(),
      barbecueId: input.eventId,
      organizerUserId: input.organizerUserId,
      participantUserId: input.participantUserId,
      participantLabel: input.participantLabel ?? null,
      participantEmail: input.participantEmail ?? null,
      status: input.status ?? "pending",
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  },

  async listForUser(userId: number) {
    const conversations = await db
      .select({
        id: publicEventConversations.id,
        barbecueId: publicEventConversations.barbecueId,
        organizerUserId: publicEventConversations.organizerUserId,
        participantUserId: publicEventConversations.participantUserId,
        participantEmail: publicEventConversations.participantEmail,
        participantLabel: publicEventConversations.participantLabel,
        status: publicEventConversations.status,
        lastMessageAt: publicEventConversations.lastMessageAt,
        createdAt: publicEventConversations.createdAt,
        updatedAt: publicEventConversations.updatedAt,
      })
      .from(publicEventConversations)
      .where(or(eq(publicEventConversations.organizerUserId, userId), eq(publicEventConversations.participantUserId, userId)))
      .orderBy(desc(publicEventConversations.lastMessageAt), desc(publicEventConversations.updatedAt));

    if (conversations.length === 0) return [];

    const eventIds = Array.from(new Set(conversations.map((c) => c.barbecueId)));
    const userIds = Array.from(new Set(conversations.flatMap((c) => [c.organizerUserId, c.participantUserId].filter((v): v is number => typeof v === "number"))));
    const convoIds = conversations.map((c) => c.id);

    const [eventRows, userRows, lastMessages] = await Promise.all([
      db.select({ id: barbecues.id, name: barbecues.name, bannerImageUrl: barbecues.bannerImageUrl, publicSlug: barbecues.publicSlug, date: barbecues.date })
        .from(barbecues).where(inArray(barbecues.id, eventIds)),
      db.select({ id: users.id, username: users.username, publicHandle: users.publicHandle, displayName: users.displayName, avatarUrl: users.avatarUrl, profileImageUrl: users.profileImageUrl })
        .from(users).where(inArray(users.id, userIds)),
      db.select({
        conversationId: publicEventMessages.conversationId,
        body: publicEventMessages.body,
        createdAt: publicEventMessages.createdAt,
      })
        .from(publicEventMessages)
        .where(inArray(publicEventMessages.conversationId, convoIds))
        .orderBy(desc(publicEventMessages.createdAt)),
    ]);

    const eventMap = new Map(eventRows.map((r) => [r.id, r]));
    const userMap = new Map(userRows.map((r) => [r.id, r]));
    const lastMessageMap = new Map<string, { body: string; createdAt: Date | null }>();
    for (const msg of lastMessages) {
      if (!lastMessageMap.has(msg.conversationId)) lastMessageMap.set(msg.conversationId, { body: msg.body, createdAt: msg.createdAt });
    }

    return conversations.map((c) => {
      const event = eventMap.get(c.barbecueId);
      const organizer = userMap.get(c.organizerUserId);
      const participant = c.participantUserId ? userMap.get(c.participantUserId) : null;
      return {
        ...c,
        event: event ? { id: event.id, title: event.name, bannerImageUrl: event.bannerImageUrl, publicSlug: event.publicSlug, date: event.date } : null,
        organizer: organizer ? { id: organizer.id, username: organizer.username, handle: organizer.publicHandle ?? organizer.username, displayName: organizer.displayName, avatarUrl: organizer.avatarUrl, profileImageUrl: organizer.profileImageUrl } : null,
        participant: participant ? { id: participant.id, username: participant.username, handle: participant.publicHandle ?? participant.username, displayName: participant.displayName, avatarUrl: participant.avatarUrl, profileImageUrl: participant.profileImageUrl } : null,
        lastMessage: lastMessageMap.get(c.id) ?? null,
      };
    });
  },

  async listForOrganizerByEvent(eventId: number, organizerUserId: number) {
    return db
      .select()
      .from(publicEventConversations)
      .where(and(eq(publicEventConversations.barbecueId, eventId), eq(publicEventConversations.organizerUserId, organizerUserId)))
      .orderBy(desc(publicEventConversations.lastMessageAt));
  },

  async getConversationById(id: string) {
    const [row] = await db.select().from(publicEventConversations).where(eq(publicEventConversations.id, id));
    return row;
  },

  async updateConversationStatus(id: string, status: "pending" | "active" | "archived" | "blocked") {
    const [row] = await db.update(publicEventConversations).set({ status, updatedAt: new Date() }).where(eq(publicEventConversations.id, id)).returning();
    return row;
  },

  async touchConversation(id: string) {
    await db.update(publicEventConversations).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(publicEventConversations.id, id));
  },

  async addMessage(input: { conversationId: string; senderUserId: number; body: string }) {
    const [row] = await db.insert(publicEventMessages).values({
      id: crypto.randomUUID(),
      conversationId: input.conversationId,
      senderUserId: input.senderUserId,
      body: input.body,
    }).returning();
    await this.touchConversation(input.conversationId);
    return row;
  },

  async listMessages(conversationId: string, limit = 100) {
    const rows = await db.select().from(publicEventMessages).where(eq(publicEventMessages.conversationId, conversationId)).orderBy(publicEventMessages.createdAt);
    const limited = rows.slice(Math.max(0, rows.length - limit));
    const senderIds = Array.from(new Set(limited.map((m) => m.senderUserId)));
    const senders = senderIds.length
      ? await db.select({ id: users.id, username: users.username, publicHandle: users.publicHandle, displayName: users.displayName, avatarUrl: users.avatarUrl, profileImageUrl: users.profileImageUrl })
        .from(users).where(inArray(users.id, senderIds))
      : [];
    const senderMap = new Map(senders.map((s) => [s.id, s]));
    return limited.map((m) => ({
      ...m,
      sender: senderMap.get(m.senderUserId) ?? null,
    }));
  },

  async markConversationRead(conversationId: string, viewerUserId: number) {
    await db.update(publicEventMessages)
      .set({ readAt: new Date() })
      .where(and(eq(publicEventMessages.conversationId, conversationId), isNull(publicEventMessages.readAt), sql`${publicEventMessages.senderUserId} <> ${viewerUserId}`));
  },
};

