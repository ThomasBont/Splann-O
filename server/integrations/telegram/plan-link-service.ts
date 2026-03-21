import { and, eq, ne, or } from "drizzle-orm";
import { db, pool } from "../../db";
import { barbecues, telegramChatLinks } from "@shared/schema";
import { log } from "../../lib/logger";

export type TelegramGroupLink = {
  id: number;
  planId: number;
  planName: string;
  planDate: Date | null;
  locationName: string | null;
  telegramChatId: string;
  telegramChatTitle: string | null;
  telegramChatType: string | null;
  linkedAt: Date | null;
  linkedByUserId: number | null;
  updatedAt: Date | null;
};

let telegramLinkSchemaReadyPromise: Promise<void> | null = null;

async function ensureTelegramLinkSchemaReady(): Promise<void> {
  if (!telegramLinkSchemaReadyPromise) {
    telegramLinkSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_chat_links (
          id serial PRIMARY KEY,
          telegram_chat_id text NOT NULL UNIQUE,
          telegram_chat_title text,
          telegram_chat_type text,
          plan_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
          connected_by_user_id integer REFERENCES users(id) ON DELETE SET NULL,
          linked_at timestamp DEFAULT now(),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE telegram_chat_links
          ADD COLUMN IF NOT EXISTS telegram_chat_title text,
          ADD COLUMN IF NOT EXISTS telegram_chat_type text,
          ADD COLUMN IF NOT EXISTS linked_at timestamp DEFAULT now()
      `);
      await pool.query(`
        UPDATE telegram_chat_links
        SET linked_at = COALESCE(linked_at, created_at, now())
        WHERE linked_at IS NULL
      `);
      await pool.query(`
        WITH ranked AS (
          SELECT
            id,
            row_number() OVER (
              PARTITION BY plan_id
              ORDER BY updated_at DESC NULLS LAST, id DESC
            ) AS rn
          FROM telegram_chat_links
        )
        DELETE FROM telegram_chat_links
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS telegram_chat_links_plan_id_unique_idx
          ON telegram_chat_links(plan_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS telegram_chat_links_plan_id_idx
          ON telegram_chat_links(plan_id)
      `);
    })().catch((error) => {
      telegramLinkSchemaReadyPromise = null;
      throw error;
    });
  }

  return telegramLinkSchemaReadyPromise;
}

function normalizeChatId(chatId: number | string) {
  const value = String(chatId).trim();
  if (!value) throw new Error("Telegram chat id is required");
  return value;
}

function normalizePlanId(planId: number) {
  const safePlanId = Number(planId);
  if (!Number.isInteger(safePlanId) || safePlanId <= 0) {
    throw new Error("Plan id must be a positive integer");
  }
  return safePlanId;
}

function normalizeChatType(type: string | null | undefined) {
  const value = String(type ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value === "group" || value === "supergroup") return value;
  return null;
}

function mapLinkRow(row: {
  id: number;
  planId: number;
  planName: string;
  planDate: Date | null;
  locationName: string | null;
  telegramChatId: string;
  telegramChatTitle: string | null;
  telegramChatType: string | null;
  linkedAt: Date | null;
  linkedByUserId: number | null;
  updatedAt: Date | null;
}): TelegramGroupLink {
  return {
    id: row.id,
    planId: row.planId,
    planName: row.planName,
    planDate: row.planDate,
    locationName: row.locationName,
    telegramChatId: row.telegramChatId,
    telegramChatTitle: row.telegramChatTitle,
    telegramChatType: row.telegramChatType,
    linkedAt: row.linkedAt,
    linkedByUserId: row.linkedByUserId,
    updatedAt: row.updatedAt,
  };
}

export async function getTelegramGroupLinkForPlan(planId: number): Promise<TelegramGroupLink | null> {
  await ensureTelegramLinkSchemaReady();
  const safePlanId = normalizePlanId(planId);
  const [row] = await db
    .select({
      id: telegramChatLinks.id,
      planId: barbecues.id,
      planName: barbecues.name,
      planDate: barbecues.date,
      locationName: barbecues.locationName,
      telegramChatId: telegramChatLinks.telegramChatId,
      telegramChatTitle: telegramChatLinks.telegramChatTitle,
      telegramChatType: telegramChatLinks.telegramChatType,
      linkedAt: telegramChatLinks.linkedAt,
      linkedByUserId: telegramChatLinks.connectedByUserId,
      updatedAt: telegramChatLinks.updatedAt,
    })
    .from(telegramChatLinks)
    .innerJoin(barbecues, eq(barbecues.id, telegramChatLinks.planId))
    .where(eq(telegramChatLinks.planId, safePlanId))
    .limit(1);

  return row ? mapLinkRow(row) : null;
}

export async function getTelegramGroupLinkByChatId(chatId: number | string): Promise<TelegramGroupLink | null> {
  await ensureTelegramLinkSchemaReady();
  const telegramChatId = normalizeChatId(chatId);
  const [row] = await db
    .select({
      id: telegramChatLinks.id,
      planId: barbecues.id,
      planName: barbecues.name,
      planDate: barbecues.date,
      locationName: barbecues.locationName,
      telegramChatId: telegramChatLinks.telegramChatId,
      telegramChatTitle: telegramChatLinks.telegramChatTitle,
      telegramChatType: telegramChatLinks.telegramChatType,
      linkedAt: telegramChatLinks.linkedAt,
      linkedByUserId: telegramChatLinks.connectedByUserId,
      updatedAt: telegramChatLinks.updatedAt,
    })
    .from(telegramChatLinks)
    .innerJoin(barbecues, eq(barbecues.id, telegramChatLinks.planId))
    .where(eq(telegramChatLinks.telegramChatId, telegramChatId))
    .limit(1);

  return row ? mapLinkRow(row) : null;
}

export async function hasTelegramLinkForPlan(planId: number): Promise<boolean> {
  return !!(await getTelegramGroupLinkForPlan(planId));
}

export async function linkTelegramGroupToPlan(input: {
  chatId: number | string;
  planId: number;
  telegramChatTitle?: string | null;
  telegramChatType?: string | null;
  linkedByUserId?: number | null;
}) {
  await ensureTelegramLinkSchemaReady();
  const telegramChatId = normalizeChatId(input.chatId);
  const planId = normalizePlanId(input.planId);
  const telegramChatTitle = String(input.telegramChatTitle ?? "").trim() || null;
  const telegramChatType = normalizeChatType(input.telegramChatType);

  const [plan] = await db
    .select({
      id: barbecues.id,
      name: barbecues.name,
    })
    .from(barbecues)
    .where(eq(barbecues.id, planId))
    .limit(1);

  if (!plan) {
    throw new Error("Plan not found");
  }

  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [existingByPlan] = await tx
      .select({
        id: telegramChatLinks.id,
        planId: telegramChatLinks.planId,
        telegramChatId: telegramChatLinks.telegramChatId,
      })
      .from(telegramChatLinks)
      .where(eq(telegramChatLinks.planId, plan.id))
      .limit(1);

    const [existingByChat] = await tx
      .select({
        id: telegramChatLinks.id,
        planId: telegramChatLinks.planId,
        telegramChatId: telegramChatLinks.telegramChatId,
      })
      .from(telegramChatLinks)
      .where(eq(telegramChatLinks.telegramChatId, telegramChatId))
      .limit(1);

    const anchorId = existingByPlan?.id ?? existingByChat?.id ?? null;
    const currentPlanId = existingByPlan?.planId ?? existingByChat?.planId ?? null;
    const currentChatId = existingByPlan?.telegramChatId ?? existingByChat?.telegramChatId ?? null;

    if (anchorId) {
      await tx
        .update(telegramChatLinks)
        .set({
          planId: plan.id,
          telegramChatId,
          telegramChatTitle,
          telegramChatType,
          connectedByUserId: input.linkedByUserId ?? null,
          linkedAt: now,
          updatedAt: now,
        })
        .where(eq(telegramChatLinks.id, anchorId));

      await tx
        .delete(telegramChatLinks)
        .where(and(
          ne(telegramChatLinks.id, anchorId),
          or(
            eq(telegramChatLinks.planId, plan.id),
            eq(telegramChatLinks.telegramChatId, telegramChatId),
          ),
        ));

      const unchanged = currentPlanId === plan.id && currentChatId === telegramChatId;
      return {
        outcome: unchanged ? "unchanged" as const : "relinked" as const,
        previousPlanId: unchanged ? undefined : currentPlanId ?? undefined,
        previousChatId: unchanged ? undefined : currentChatId ?? undefined,
      };
    }

    await tx.insert(telegramChatLinks).values({
      planId: plan.id,
      telegramChatId,
      telegramChatTitle,
      telegramChatType,
      connectedByUserId: input.linkedByUserId ?? null,
      linkedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return {
      outcome: "linked" as const,
      previousPlanId: undefined,
      previousChatId: undefined,
    };
  });

  log("info", "telegram_group_link_saved", {
    chatId: telegramChatId,
    chatType: telegramChatType,
    planId: plan.id,
    outcome: result.outcome,
    previousPlanId: result.previousPlanId ?? null,
    previousChatId: result.previousChatId ?? null,
  });

  return {
    outcome: result.outcome,
    previousPlanId: result.previousPlanId,
    previousChatId: result.previousChatId,
    planId: plan.id,
    planName: plan.name,
    telegramChatId,
    telegramChatTitle,
    telegramChatType,
  };
}

export async function unlinkTelegramGroupFromPlan(input: {
  planId: number;
  telegramChatId?: number | string | null;
}) {
  await ensureTelegramLinkSchemaReady();
  const planId = normalizePlanId(input.planId);
  const chatId = input.telegramChatId == null ? null : normalizeChatId(input.telegramChatId);

  const whereClause = chatId
    ? and(eq(telegramChatLinks.planId, planId), eq(telegramChatLinks.telegramChatId, chatId))
    : eq(telegramChatLinks.planId, planId);

  const rows = await db
    .delete(telegramChatLinks)
    .where(whereClause)
    .returning({
      id: telegramChatLinks.id,
      planId: telegramChatLinks.planId,
      telegramChatId: telegramChatLinks.telegramChatId,
    });

  return {
    removed: rows.length > 0,
    removedCount: rows.length,
  };
}

// Backward-compatible wrappers for current Telegram transport code.
export async function getLinkedPlanForTelegramChat(chatId: number | string) {
  return getTelegramGroupLinkByChatId(chatId);
}

export async function linkTelegramChatToPlan(input: {
  chatId: number | string;
  planId: number;
  connectedByUserId?: number | null;
}) {
  return linkTelegramGroupToPlan({
    chatId: input.chatId,
    planId: input.planId,
    linkedByUserId: input.connectedByUserId ?? null,
  });
}
