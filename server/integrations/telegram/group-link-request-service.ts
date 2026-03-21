import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db, pool } from "../../db";
import { barbecues, telegramGroupLinkRequests } from "@shared/schema";

const REQUEST_TTL_MS = 15 * 60 * 1000;
const GROUP_LINK_PAYLOAD_PREFIX = "glink";

let telegramGroupLinkRequestSchemaReadyPromise: Promise<void> | null = null;

async function ensureTelegramGroupLinkRequestSchemaReady(): Promise<void> {
  if (!telegramGroupLinkRequestSchemaReadyPromise) {
    telegramGroupLinkRequestSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_group_link_requests (
          id serial PRIMARY KEY,
          token text NOT NULL UNIQUE,
          plan_id integer NOT NULL REFERENCES barbecues(id) ON DELETE CASCADE,
          requested_by_telegram_user_id text,
          expires_at timestamp NOT NULL,
          consumed_at timestamp,
          consumed_by_chat_id text,
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS telegram_group_link_requests_plan_id_idx
          ON telegram_group_link_requests(plan_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS telegram_group_link_requests_expires_at_idx
          ON telegram_group_link_requests(expires_at)
      `);
    })().catch((error) => {
      telegramGroupLinkRequestSchemaReadyPromise = null;
      throw error;
    });
  }

  return telegramGroupLinkRequestSchemaReadyPromise;
}

function normalizePlanId(planId: number) {
  const safePlanId = Number(planId);
  if (!Number.isInteger(safePlanId) || safePlanId <= 0) {
    throw new Error("Plan id must be a positive integer");
  }
  return safePlanId;
}

function normalizeChatId(chatId: number | string) {
  const value = String(chatId).trim();
  if (!value) throw new Error("Telegram chat id is required");
  return value;
}

function normalizeTelegramUserId(userId: number | string | null | undefined) {
  const value = String(userId ?? "").trim();
  return value || null;
}

function createToken() {
  return randomBytes(12).toString("hex");
}

export function createTelegramGroupLinkPayload(token: string) {
  const normalized = String(token ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(normalized)) {
    throw new Error("Invalid group link token");
  }
  return `${GROUP_LINK_PAYLOAD_PREFIX}_${normalized}`;
}

export function parseTelegramGroupLinkPayload(payload: string | null | undefined): { token: string } | null {
  const value = String(payload ?? "").trim().toLowerCase();
  if (!value) return null;
  const match = /^glink_([a-f0-9]{24})$/.exec(value);
  if (!match) return null;
  return { token: match[1] };
}

export async function createPendingTelegramGroupLinkRequest(input: {
  planId: number;
  requestedByTelegramUserId?: number | string | null;
}) {
  await ensureTelegramGroupLinkRequestSchemaReady();
  const planId = normalizePlanId(input.planId);
  const requestedByTelegramUserId = normalizeTelegramUserId(input.requestedByTelegramUserId);

  const [plan] = await db
    .select({
      id: barbecues.id,
      name: barbecues.name,
    })
    .from(barbecues)
    .where(eq(barbecues.id, planId))
    .limit(1);

  if (!plan) throw new Error("Plan not found");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS);
  const token = createToken();

  await db.insert(telegramGroupLinkRequests).values({
    token,
    planId: plan.id,
    requestedByTelegramUserId,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  return {
    token,
    planId: plan.id,
    planName: plan.name,
    expiresAt,
    payload: createTelegramGroupLinkPayload(token),
  };
}

export async function consumePendingTelegramGroupLinkRequest(input: {
  token: string;
  chatId: number | string;
  telegramUserId?: number | string | null;
}) {
  await ensureTelegramGroupLinkRequestSchemaReady();
  const token = String(input.token ?? "").trim().toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(token)) {
    throw new Error("Invalid token");
  }
  const consumedByChatId = normalizeChatId(input.chatId);
  const telegramUserId = normalizeTelegramUserId(input.telegramUserId);
  const now = new Date();

  const [request] = await db
    .select({
      id: telegramGroupLinkRequests.id,
      token: telegramGroupLinkRequests.token,
      planId: telegramGroupLinkRequests.planId,
      planName: barbecues.name,
      requestedByTelegramUserId: telegramGroupLinkRequests.requestedByTelegramUserId,
      expiresAt: telegramGroupLinkRequests.expiresAt,
      consumedAt: telegramGroupLinkRequests.consumedAt,
    })
    .from(telegramGroupLinkRequests)
    .innerJoin(barbecues, eq(barbecues.id, telegramGroupLinkRequests.planId))
    .where(eq(telegramGroupLinkRequests.token, token))
    .limit(1);

  if (!request) return { code: "not_found" as const };
  if (request.consumedAt) return { code: "already_used" as const, planId: request.planId, planName: request.planName };
  if (request.expiresAt.getTime() < now.getTime()) return { code: "expired" as const };

  if (request.requestedByTelegramUserId && telegramUserId && request.requestedByTelegramUserId !== telegramUserId) {
    return { code: "wrong_user" as const };
  }

  const [updated] = await db
    .update(telegramGroupLinkRequests)
    .set({
      consumedAt: now,
      consumedByChatId,
      updatedAt: now,
    })
    .where(and(
      eq(telegramGroupLinkRequests.id, request.id),
      isNull(telegramGroupLinkRequests.consumedAt),
    ))
    .returning({
      id: telegramGroupLinkRequests.id,
      planId: telegramGroupLinkRequests.planId,
    });

  if (!updated) {
    return { code: "already_used" as const, planId: request.planId, planName: request.planName };
  }

  return {
    code: "ok" as const,
    planId: request.planId,
    planName: request.planName,
  };
}
