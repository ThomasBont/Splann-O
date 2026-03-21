import type { EventChatMessage } from "../../lib/eventChatStore";
import { getChatMessageSource } from "../../lib/chat-message-source";
import { mergeEventChatMessageMetadata } from "../../lib/eventChatStore";
import { log } from "../../lib/logger";
import { sendTelegramGroupTextMessage } from "./bot";
import { getTelegramGroupLinkForPlan } from "./plan-link-service";

type OutboundResult =
  | { status: "skipped"; reason: string }
  | { status: "sent"; telegramChatId: string; telegramMessageId: number };

function formatOutboundMessage(input: {
  authorName: string;
  text: string;
}) {
  const authorName = String(input.authorName ?? "").trim() || "Someone";
  const text = String(input.text ?? "").trim();
  return `${authorName}: ${text}`;
}

export async function forwardAppChatMessageToTelegram(input: {
  eventId: number;
  message: EventChatMessage;
}): Promise<OutboundResult> {
  if (input.message.type !== "user") {
    return { status: "skipped", reason: "non_user_message" };
  }

  const metadata = input.message.metadata && typeof input.message.metadata === "object"
    ? input.message.metadata as Record<string, unknown>
    : null;
  const source = getChatMessageSource(metadata);
  if (source !== "app") {
    return { status: "skipped", reason: "non_app_source" };
  }

  const text = String(input.message.text ?? "").trim();
  if (!text) {
    return { status: "skipped", reason: "empty_text" };
  }

  const link = await getTelegramGroupLinkForPlan(input.eventId);
  if (!link) {
    return { status: "skipped", reason: "plan_not_linked" };
  }

  const outboundText = formatOutboundMessage({
    authorName: input.message.user?.name ?? "Someone",
    text,
  });
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
