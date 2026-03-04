import { randomUUID } from "crypto";
import { appendEventChatMessage } from "./eventChatStore";
import { broadcastEventRealtime } from "./eventRealtime";

export async function postSystemChatMessage(eventId: number, text: string): Promise<void> {
  const content = text.trim();
  if (!content) return;
  const saved = await appendEventChatMessage(eventId, {
    type: "system",
    text: content,
    clientMessageId: randomUUID(),
  });
  if (!saved.inserted) return;
  broadcastEventRealtime(eventId, { type: "chat:new", message: saved.message });
  broadcastEventRealtime(eventId, { type: "message", message: saved.message });
}
