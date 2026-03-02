import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { eventChatMessages } from "@shared/schema";

export type EventChatMessage = {
  id: string;
  eventId: string;
  type: "user" | "system";
  text: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
};

export type EventChatPage = {
  messages: EventChatMessage[];
  nextCursor?: string;
};

const MAX_PAGE_SIZE = 200;

function toMessage(row: typeof eventChatMessages.$inferSelect): EventChatMessage {
  return {
    id: row.id,
    eventId: String(row.eventId),
    type: row.type === "system" ? "system" : "user",
    text: row.content,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    user: row.authorUserId
      ? {
          id: String(row.authorUserId),
          name: row.authorName || "Unknown user",
          avatarUrl: row.authorAvatarUrl ?? null,
        }
      : undefined,
  };
}

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

function parseCursor(cursor?: string | null): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [createdAtRaw, id] = cursor.split("|");
  if (!createdAtRaw || !id) return null;
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
}

export async function listEventChatMessages(
  eventId: number,
  options?: { limit?: number; before?: string | null },
): Promise<EventChatPage> {
  const safeLimit = Number.isFinite(options?.limit)
    ? Math.min(Math.max(Math.trunc(options!.limit!), 1), MAX_PAGE_SIZE)
    : 50;
  const before = parseCursor(options?.before ?? null);

  const whereClause = before
    ? and(
        eq(eventChatMessages.eventId, eventId),
        sql`(${eventChatMessages.createdAt} < ${before.createdAt} OR (${eventChatMessages.createdAt} = ${before.createdAt} AND ${eventChatMessages.id} < ${before.id}))`,
      )
    : eq(eventChatMessages.eventId, eventId);

  const rows = await db
    .select()
    .from(eventChatMessages)
    .where(whereClause)
    .orderBy(desc(eventChatMessages.createdAt), desc(eventChatMessages.id))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
  const oldest = pageRows[pageRows.length - 1];
  const messages = pageRows.reverse().map(toMessage);

  return {
    messages,
    nextCursor: hasMore && oldest?.createdAt ? encodeCursor(oldest.createdAt, oldest.id) : undefined,
  };
}

export async function appendEventChatMessage(
  eventId: number,
  input: {
    type?: "user" | "system";
    text: string;
    user?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  },
): Promise<EventChatMessage> {
  const authorId = input.user?.id ? Number(input.user.id) : null;
  const [created] = await db.insert(eventChatMessages).values({
    eventId,
    authorUserId: Number.isFinite(authorId) ? authorId : null,
    authorName: input.user?.name ?? null,
    authorAvatarUrl: input.user?.avatarUrl ?? null,
    type: input.type ?? "user",
    content: input.text,
    createdAt: new Date(),
  }).returning();

  return toMessage(created);
}

