import { randomUUID } from "crypto";

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

const EVENT_CHAT_MAX_MESSAGES = 200;
const store = new Map<number, EventChatMessage[]>();

export function listEventChatMessages(eventId: number, limit = 50): EventChatMessage[] {
  const rows = store.get(eventId) ?? [];
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;
  return rows.slice(-safeLimit);
}

export function appendEventChatMessage(
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
): EventChatMessage {
  const message: EventChatMessage = {
    id: randomUUID(),
    eventId: String(eventId),
    type: input.type ?? "user",
    text: input.text,
    createdAt: new Date().toISOString(),
    user: input.user,
  };

  const rows = store.get(eventId) ?? [];
  rows.push(message);
  if (rows.length > EVENT_CHAT_MAX_MESSAGES) {
    rows.splice(0, rows.length - EVENT_CHAT_MAX_MESSAGES);
  }
  store.set(eventId, rows);
  return message;
}

/**
 * TODO(chat-persistence): Replace in-memory storage with persistent table-backed history
 * when event-room chat schema is finalized.
 */
