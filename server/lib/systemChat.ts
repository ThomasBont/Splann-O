import { randomUUID } from "crypto";
import { appendEventChatMessage } from "./eventChatStore";
import { broadcastEventRealtime } from "./eventRealtime";

export async function postSystemChatMessage(
  eventId: number,
  text: string,
  metadata?: Record<string, unknown> | null,
  options?: { clientMessageId?: string },
): Promise<void> {
  const content = text.trim();
  if (!content) return;
  const forcedClientMessageId = options?.clientMessageId?.trim();
  const saved = await appendEventChatMessage(eventId, {
    type: "system",
    text: content,
    metadata: metadata ?? null,
    clientMessageId: forcedClientMessageId || randomUUID(),
  });
  if (!saved.inserted) return;
  broadcastEventRealtime(eventId, { type: "chat:new", message: saved.message });
}
