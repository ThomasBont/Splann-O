import type { EventChatMessage } from "../../lib/eventChatStore";
import { getChatMessageSource } from "../../lib/chat-message-source";
import { mergeEventChatMessageMetadata } from "../../lib/eventChatStore";
import { log } from "../../lib/logger";
import { sendTelegramGroupTextMessage } from "./bot";
import { getTelegramGroupLinkForPlan } from "./plan-link-service";

type OutboundResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; telegramChatId: string; telegramMessageId: number };

function resolveRelayAuthorLabel(input: {
  displayName?: string | null;
  username?: string | null;
}) {
  const displayName = String(input.displayName ?? "").trim();
  if (displayName) return displayName;
  const username = String(input.username ?? "").trim();
  if (username) return username;
  return "Splann-O member";
}

export function formatTelegramRelayMessage(input: {
  displayName?: string | null;
  username?: string | null;
  text: string;
}) {
  const authorLabel = resolveRelayAuthorLabel({
    displayName: input.displayName,
    username: input.username,
  });
  const text = String(input.text ?? "").trim();
  if (!text) return "";
  return `${authorLabel} via Splann-O\n${text}`;
}

export function formatTelegramSystemMessage(input: {
  text: string;
}) {
  const text = String(input.text ?? "").trim();
  if (!text) return "";
  return `Splann-O\n${text}`;
}

export async function forwardAppChatMessageToTelegram(input: {
  eventId: number;
  message: EventChatMessage;
}): Promise<OutboundResult> {
  const metadata = input.message.metadata && typeof input.message.metadata === "object"
    ? input.message.metadata as Record<string, unknown>
    : null;
  const source = getChatMessageSource(metadata);
  if (source === "telegram") {
    return { status: "skipped", reason: "telegram_source" };
  }
  if (input.message.type === "user" && source !== "app") {
    return { status: "skipped", reason: "non_app_source" };
  }
  if (input.message.type !== "user" && input.message.type !== "system") {
    return { status: "skipped", reason: "unsupported_message_type" };
  }

  const text = String(input.message.text ?? "").trim();
  if (!text) {
    return { status: "skipped", reason: "empty_text" };
  }

  const link = await getTelegramGroupLinkForPlan(input.eventId);
  if (!link) {
    return { status: "skipped", reason: "plan_not_linked" };
  }

  const outboundText = input.message.type === "system"
    ? formatTelegramSystemMessage({ text })
    : formatTelegramRelayMessage({
      displayName: input.message.user?.name ?? null,
      username: input.message.user?.name ?? null,
      text,
    });
  if (!outboundText) {
    return { status: "skipped", reason: "empty_formatted_text" };
  }
  const sent = await sendTelegramGroupTextMessage(link.telegramChatId, outboundText);
  await mergeEventChatMessageMetadata({
    eventId: input.eventId,
    messageId: input.message.id,
    merge: {
      telegramOutbound: {
        chatId: String(link.telegramChatId),
        messageId: Number(sent.message_id),
        sentAt: new Date().toISOString(),
      },
    },
  });

  log("info", "telegram_outbound_message_sent", {
    eventId: input.eventId,
    messageId: input.message.id,
    telegramChatId: String(link.telegramChatId),
    telegramMessageId: Number(sent.message_id),
  });

  return {
    status: "sent",
    telegramChatId: String(link.telegramChatId),
    telegramMessageId: Number(sent.message_id),
  };
}
