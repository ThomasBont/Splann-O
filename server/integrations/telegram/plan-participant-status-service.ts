import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { eventChatMessages } from "@shared/schema";
import { getTelegramGroupLinkForPlan } from "./plan-link-service";
import { listLinkedTelegramAccountsForUsers } from "./telegram-identity-service";

export type TelegramParticipantStatus =
  | "not_connected"
  | "connected"
  | "in_group"
  | "connected_not_in_group";

export type TelegramParticipantStatusView = {
  telegramStatus: TelegramParticipantStatus;
  hasTelegramLinked: boolean;
  detectedInLinkedTelegramGroup: boolean;
  telegramDisplayLabel: string | null;
};

function buildTelegramDisplayLabel(input: {
  username?: string | null;
  firstName: string;
  lastName?: string | null;
}) {
  const username = String(input.username ?? "").trim();
  if (username) return `@${username}`;
  const fullName = [String(input.firstName ?? "").trim(), String(input.lastName ?? "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || null;
}

export async function getTelegramParticipantStatusesForPlan(input: {
  planId: number;
  participantUserIds: number[];
}): Promise<Map<number, TelegramParticipantStatusView>> {
  const safePlanId = Number(input.planId);
  if (!Number.isInteger(safePlanId) || safePlanId <= 0) return new Map();

  const userIds = Array.from(new Set(
    input.participantUserIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ));
  if (userIds.length === 0) return new Map();

  const [groupLink, linkedAccounts] = await Promise.all([
    getTelegramGroupLinkForPlan(safePlanId),
    listLinkedTelegramAccountsForUsers(userIds),
  ]);

  const byUserId = new Map(linkedAccounts.map((account) => [account.userId, account]));
  const observedTelegramUserIds = new Set<string>();

  if (groupLink && linkedAccounts.length > 0) {
    const rows = await db
      .select({
        telegramUserId: sql<string>`trim(${eventChatMessages.metadata} -> 'telegram' ->> 'userId')`,
      })
      .from(eventChatMessages)
      .where(and(
        eq(eventChatMessages.eventId, safePlanId),
        isNull(eventChatMessages.hiddenAt),
        isNull(eventChatMessages.deletedAt),
        sql`${eventChatMessages.metadata} ->> 'source' = 'telegram'`,
        sql`${eventChatMessages.metadata} -> 'telegram' ->> 'chatId' = ${groupLink.telegramChatId}`,
        sql`${eventChatMessages.metadata} -> 'telegram' ->> 'userId' IS NOT NULL`,
      ));

    for (const row of rows) {
      const telegramUserId = String(row.telegramUserId ?? "").trim();
      if (telegramUserId) observedTelegramUserIds.add(telegramUserId);
    }
  }

  const result = new Map<number, TelegramParticipantStatusView>();
  for (const userId of userIds) {
    const linked = byUserId.get(userId);
    if (!linked) {
      result.set(userId, {
        telegramStatus: "not_connected",
        hasTelegramLinked: false,
        detectedInLinkedTelegramGroup: false,
        telegramDisplayLabel: null,
      });
      continue;
    }

    const detected = !!groupLink && observedTelegramUserIds.has(String(linked.telegramUserId));
    let status: TelegramParticipantStatus = "connected";
    if (groupLink) {
      status = detected ? "in_group" : "connected_not_in_group";
    }

    result.set(userId, {
      telegramStatus: status,
      hasTelegramLinked: true,
      detectedInLinkedTelegramGroup: detected,
      telegramDisplayLabel: buildTelegramDisplayLabel({
        username: linked.username,
        firstName: linked.firstName,
        lastName: linked.lastName,
      }),
    });
  }

  return result;
}
