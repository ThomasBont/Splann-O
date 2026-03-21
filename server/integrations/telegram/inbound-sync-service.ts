import { createHash } from "node:crypto";
import TelegramBot from "node-telegram-bot-api";
import { appendEventChatMessage } from "../../lib/eventChatStore";
import { broadcastEventRealtime } from "../../lib/eventRealtime";
import { getTelegramGroupLinkByChatId } from "./plan-link-service";

type InboundSyncResult =
  | { status: "ignored"; reason: string }
  | { status: "synced"; eventId: number; inserted: boolean; messageId: string };

function isGroupChat(chatType: TelegramBot.Chat["type"]) {
  return chatType === "group" || chatType === "supergroup";
}

function toDeterministicUuid(value: string) {
  const hash = createHash("sha256").update(value).digest("hex").slice(0, 32);
  const part1 = hash.slice(0, 8);
  const part2 = hash.slice(8, 12);
  const part3 = `4${hash.slice(13, 16)}`;
  const part4 = `${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${hash.slice(18, 20)}`;
  const part5 = hash.slice(20, 32);
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

function formatTelegramSenderName(message: TelegramBot.Message) {
  const firstName = String(message.from?.first_name ?? "").trim();
  const lastName = String(message.from?.last_name ?? "").trim();
  const username = String(message.from?.username ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || (username ? `@${username}` : "Telegram user");
}

function extractTelegramText(message: TelegramBot.Message) {
  const text = typeof message.text === "string" ? message.text.trim() : "";
  if (text) return text;
  const caption = typeof message.caption === "string" ? message.caption.trim() : "";
  return caption || "";
}

function toTelegramCreatedAt(message: TelegramBot.Message) {
  const unixSeconds = Number(message.date);
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) return new Date();
  return new Date(unixSeconds * 1000);
}

export async function ingestTelegramGroupMessage(message: TelegramBot.Message): Promise<InboundSyncResult> {
  if (!isGroupChat(message.chat.type)) {
    return { status: "ignored", reason: "not_group_chat" };
  }
  if (message.from?.is_bot) {
    return { status: "ignored", reason: "bot_message" };
  }

  const text = extractTelegramText(message);
  if (!text) {
    return { status: "ignored", reason: "unsupported_message_type" };
  }
  if (text.startsWith("/")) {
    return { status: "ignored", reason: "command_message" };
  }

  const chatId = String(message.chat.id);
  const linked = await getTelegramGroupLinkByChatId(chatId);
  if (!linked) {
    return { status: "ignored", reason: "unlinked_chat" };
  }

  const clientMessageId = toDeterministicUuid(`tg:${chatId}:${message.message_id}`);
  const senderName = formatTelegramSenderName(message);
  const senderUserId = String(message.from?.id ?? "").trim();
  const createdAt = toTelegramCreatedAt(message);

  const saved = await appendEventChatMessage(linked.planId, {
    type: "user",
    text,
    clientMessageId,
    user: {
      id: "",
      name: senderName,
      avatarUrl: null,
    },
    metadata: {
      source: "telegram",
      telegram: {
        chatId,
        chatType: message.chat.type,
        chatTitle: message.chat.title ?? null,
        messageId: message.message_id,
        userId: senderUserId || null,
        username: message.from?.username ?? null,
        senderDisplayName: senderName,
        createdAt: createdAt.toISOString(),
      },
    },
    createdAt,
  });

  if (saved.inserted) {
    broadcastEventRealtime(linked.planId, {
      type: "chat:new",
      eventId: linked.planId,
      message: saved.message,
    });
  }

  return {
    status: "synced",
    eventId: linked.planId,
    inserted: saved.inserted,
    messageId: saved.message.id,
  };
}
