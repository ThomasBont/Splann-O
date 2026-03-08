import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { eventChatMessageReactions, eventChatMessages } from "@shared/schema";
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from "@shared/lib/system-user";
import { ensureAutoSettlement } from "./settlement";

const SUPPORTED_REACTIONS = new Set(["😀", "😂", "😍", "🙏", "🔥", "🎉", "👍", "❤️"]);

export type EventChatReaction = {
  emoji: string;
  count: number;
  me: boolean;
};

export type EventChatMessage = {
  id: string;
  eventId: string;
  clientMessageId: string;
  type: "user" | "system" | "poll";
  text: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  serverCreatedAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  reactions?: EventChatReaction[];
};

export type EventChatPage = {
  messages: EventChatMessage[];
  nextCursor?: string;
};

const MAX_PAGE_SIZE = 200;

export function serializeEventChatMessage(
  row: typeof eventChatMessages.$inferSelect,
  reactions: EventChatReaction[] = [],
): EventChatMessage {
  const createdAtIso = row.createdAt ? row.createdAt.toISOString() : new Date().toISOString();
  return {
    id: row.id,
    eventId: String(row.eventId),
    clientMessageId: row.clientMessageId,
    type: row.type === "system" ? "system" : (row.type === "poll" ? "poll" : "user"),
    text: row.content,
    metadata: row.metadata ?? null,
    createdAt: createdAtIso,
    serverCreatedAt: createdAtIso,
    user: row.type === "system"
      ? {
          id: SYSTEM_USER_ID,
          name: row.authorName || SYSTEM_USER_NAME,
          avatarUrl: row.authorAvatarUrl ?? null,
        }
      : row.authorUserId
      ? {
          id: String(row.authorUserId),
          name: row.authorName || "Unknown user",
          avatarUrl: row.authorAvatarUrl ?? null,
        }
      : undefined,
    reactions,
  };
}

function aggregateReactions(
  rows: Array<typeof eventChatMessageReactions.$inferSelect>,
  viewerUserId?: number,
): EventChatReaction[] {
  const grouped = new Map<string, { count: number; me: boolean }>();
  for (const row of rows) {
    const key = row.emoji;
    const current = grouped.get(key) ?? { count: 0, me: false };
    current.count += 1;
    if (viewerUserId && row.userId === viewerUserId) current.me = true;
    grouped.set(key, current);
  }
  return Array.from(grouped.entries())
    .map(([emoji, value]) => ({ emoji, count: value.count, me: value.me }))
    .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
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
  options?: { limit?: number; before?: string | null; viewerUserId?: number },
): Promise<EventChatPage> {
  // Trigger auto-settle checks during normal reads (idempotent).
  await ensureAutoSettlement(eventId);

  const safeLimit = Number.isFinite(options?.limit)
    ? Math.min(Math.max(Math.trunc(options!.limit!), 1), MAX_PAGE_SIZE)
    : 50;
  const before = parseCursor(options?.before ?? null);

  const whereClause = before
    ? and(
        eq(eventChatMessages.eventId, eventId),
        isNull(eventChatMessages.hiddenAt),
        sql`(${eventChatMessages.createdAt} < ${before.createdAt} OR (${eventChatMessages.createdAt} = ${before.createdAt} AND ${eventChatMessages.id} < ${before.id}))`,
      )
    : and(eq(eventChatMessages.eventId, eventId), isNull(eventChatMessages.hiddenAt));

  const rows = await db
    .select()
    .from(eventChatMessages)
    .where(whereClause)
    .orderBy(desc(eventChatMessages.createdAt), desc(eventChatMessages.id))
    .limit(safeLimit + 1);

  const hasMore = rows.length > safeLimit;
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
  const oldest = pageRows[pageRows.length - 1];
  const messageIds = pageRows.map((row) => row.id);
  const reactionRows = messageIds.length
    ? await db.select().from(eventChatMessageReactions).where(inArray(eventChatMessageReactions.messageId, messageIds))
    : [];
  const reactionsByMessageId = new Map<string, Array<typeof eventChatMessageReactions.$inferSelect>>();
  for (const row of reactionRows) {
    const bucket = reactionsByMessageId.get(row.messageId) ?? [];
    bucket.push(row);
    reactionsByMessageId.set(row.messageId, bucket);
  }
  const messages = pageRows.reverse().map((row) => serializeEventChatMessage(
    row,
    aggregateReactions(reactionsByMessageId.get(row.id) ?? [], options?.viewerUserId),
  ));

  return {
    messages,
    nextCursor: hasMore && oldest?.createdAt ? encodeCursor(oldest.createdAt, oldest.id) : undefined,
  };
}

export async function appendEventChatMessage(
  eventId: number,
  input: {
    id?: string;
    type?: "user" | "system" | "poll";
    text: string;
    metadata?: Record<string, unknown> | null;
    clientMessageId: string;
    user?: {
      id: string;
      name: string;
      avatarUrl?: string | null;
    };
  },
): Promise<{ message: EventChatMessage; inserted: boolean }> {
  const authorId = input.user?.id ? Number(input.user.id) : null;
  const systemMessage = input.type === "system";
  const [created] = await db.insert(eventChatMessages).values({
    id: input.id,
    eventId,
    authorUserId: systemMessage ? null : (Number.isFinite(authorId) ? authorId : null),
    authorName: input.user?.name ?? (systemMessage ? SYSTEM_USER_NAME : null),
    authorAvatarUrl: input.user?.avatarUrl ?? null,
    clientMessageId: input.clientMessageId,
    type: systemMessage ? "system" : (input.type ?? "user"),
    content: input.text,
    metadata: input.metadata ?? null,
    createdAt: new Date(),
  }).onConflictDoNothing({
    target: [eventChatMessages.eventId, eventChatMessages.clientMessageId],
  }).returning();

  if (created) return { message: serializeEventChatMessage(created, []), inserted: true };

  const [existing] = await db
    .select()
    .from(eventChatMessages)
    .where(and(
      eq(eventChatMessages.eventId, eventId),
      eq(eventChatMessages.clientMessageId, input.clientMessageId),
      isNull(eventChatMessages.hiddenAt),
    ))
    .limit(1);

  if (!existing) {
    throw new Error("Message persistence conflict without existing row");
  }
  const viewerUserId = typeof authorId === "number" && Number.isFinite(authorId) ? authorId : undefined;
  const reactions = await listMessageReactions(existing.id, viewerUserId);
  return { message: serializeEventChatMessage(existing, reactions), inserted: false };
}

export async function listMessageReactions(messageId: string, viewerUserId?: number): Promise<EventChatReaction[]> {
  const rows = await db
    .select()
    .from(eventChatMessageReactions)
    .where(eq(eventChatMessageReactions.messageId, messageId));
  return aggregateReactions(rows, viewerUserId);
}

export async function toggleEventChatReaction(input: {
  eventId: number;
  messageId: string;
  userId: number;
  emoji: string;
}): Promise<EventChatReaction[]> {
  const emoji = input.emoji.trim();
  if (!SUPPORTED_REACTIONS.has(emoji)) {
    throw new Error("Unsupported reaction");
  }
  const [message] = await db
    .select({ id: eventChatMessages.id })
    .from(eventChatMessages)
    .where(and(
      eq(eventChatMessages.id, input.messageId),
      eq(eventChatMessages.eventId, input.eventId),
      isNull(eventChatMessages.hiddenAt),
    ))
    .limit(1);
  if (!message) throw new Error("Message not found");

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: eventChatMessageReactions.id })
      .from(eventChatMessageReactions)
      .where(and(
        eq(eventChatMessageReactions.messageId, input.messageId),
        eq(eventChatMessageReactions.userId, input.userId),
        eq(eventChatMessageReactions.emoji, emoji),
      ))
      .limit(1);
    if (existing) {
      await tx.delete(eventChatMessageReactions).where(eq(eventChatMessageReactions.id, existing.id));
    } else {
      await tx.insert(eventChatMessageReactions).values({
        messageId: input.messageId,
        userId: input.userId,
        emoji,
      });
    }
  });

  return listMessageReactions(input.messageId, input.userId);
}
