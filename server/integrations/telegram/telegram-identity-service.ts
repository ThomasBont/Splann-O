import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../../db";
import { userTelegramAccounts } from "@shared/schema";

export type TelegramIdentityLink = {
  id: number;
  userId: number;
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  linkedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

let telegramIdentitySchemaReadyPromise: Promise<void> | null = null;

async function ensureTelegramIdentitySchemaReady(): Promise<void> {
  if (!telegramIdentitySchemaReadyPromise) {
    telegramIdentitySchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_telegram_accounts (
          id serial PRIMARY KEY,
          user_id integer NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          telegram_user_id text NOT NULL UNIQUE,
          username text,
          first_name text NOT NULL,
          last_name text,
          photo_url text,
          linked_at timestamp DEFAULT now(),
          created_at timestamp DEFAULT now(),
          updated_at timestamp DEFAULT now()
        )
      `);
      await pool.query(`
        ALTER TABLE user_telegram_accounts
          ADD COLUMN IF NOT EXISTS linked_at timestamp DEFAULT now(),
          ADD COLUMN IF NOT EXISTS username text,
          ADD COLUMN IF NOT EXISTS first_name text,
          ADD COLUMN IF NOT EXISTS last_name text,
          ADD COLUMN IF NOT EXISTS photo_url text
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS user_telegram_accounts_user_id_idx
          ON user_telegram_accounts(user_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS user_telegram_accounts_telegram_user_id_idx
          ON user_telegram_accounts(telegram_user_id)
      `);
    })().catch((error) => {
      telegramIdentitySchemaReadyPromise = null;
      throw error;
    });
  }
  return telegramIdentitySchemaReadyPromise;
}

function mapRow(row: typeof userTelegramAccounts.$inferSelect): TelegramIdentityLink {
  return {
    id: row.id,
    userId: row.userId,
    telegramUserId: row.telegramUserId,
    username: row.username ?? null,
    firstName: row.firstName,
    lastName: row.lastName ?? null,
    photoUrl: row.photoUrl ?? null,
    linkedAt: row.linkedAt ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export async function getLinkedTelegramAccountForUser(userId: number): Promise<TelegramIdentityLink | null> {
  await ensureTelegramIdentitySchemaReady();
  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) return null;

  const [row] = await db
    .select()
    .from(userTelegramAccounts)
    .where(eq(userTelegramAccounts.userId, safeUserId))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function getLinkedTelegramAccountByTelegramUserId(telegramUserId: number | string): Promise<TelegramIdentityLink | null> {
  await ensureTelegramIdentitySchemaReady();
  const normalized = String(telegramUserId ?? "").trim();
  if (!normalized) return null;

  const [row] = await db
    .select()
    .from(userTelegramAccounts)
    .where(eq(userTelegramAccounts.telegramUserId, normalized))
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function listLinkedTelegramAccountsForUsers(userIds: number[]): Promise<TelegramIdentityLink[]> {
  await ensureTelegramIdentitySchemaReady();
  const safeUserIds = Array.from(new Set(
    userIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  ));
  if (safeUserIds.length === 0) return [];

  const rows = await db
    .select()
    .from(userTelegramAccounts)
    .where(inArray(userTelegramAccounts.userId, safeUserIds));
  return rows.map(mapRow);
}

export async function linkTelegramAccountToUser(input: {
  userId: number;
  telegramUserId: number | string;
  username?: string | null;
  firstName: string;
  lastName?: string | null;
  photoUrl?: string | null;
}): Promise<TelegramIdentityLink> {
  await ensureTelegramIdentitySchemaReady();

  const userId = Number(input.userId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Invalid user id");
  }
  const telegramUserId = String(input.telegramUserId ?? "").trim();
  if (!telegramUserId) {
    throw new Error("Telegram user id is required");
  }
  const firstName = String(input.firstName ?? "").trim();
  if (!firstName) {
    throw new Error("Telegram first name is required");
  }
  const username = String(input.username ?? "").trim() || null;
  const lastName = String(input.lastName ?? "").trim() || null;
  const photoUrl = String(input.photoUrl ?? "").trim() || null;
  const now = new Date();

  return db.transaction(async (tx) => {
    const [existingByTelegram] = await tx
      .select()
      .from(userTelegramAccounts)
      .where(eq(userTelegramAccounts.telegramUserId, telegramUserId))
      .limit(1);
    if (existingByTelegram && existingByTelegram.userId !== userId) {
      throw new Error("This Telegram account is already linked to another Splann-O user.");
    }

    const [existingByUser] = await tx
      .select()
      .from(userTelegramAccounts)
      .where(eq(userTelegramAccounts.userId, userId))
      .limit(1);

    if (existingByUser) {
      const [updated] = await tx
        .update(userTelegramAccounts)
        .set({
          telegramUserId,
          username,
          firstName,
          lastName,
          photoUrl,
          linkedAt: now,
          updatedAt: now,
        })
        .where(eq(userTelegramAccounts.id, existingByUser.id))
        .returning();
      if (!updated) throw new Error("Failed to update Telegram account link");
      return mapRow(updated);
    }

    const [created] = await tx
      .insert(userTelegramAccounts)
      .values({
        userId,
        telegramUserId,
        username,
        firstName,
        lastName,
        photoUrl,
        linkedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) throw new Error("Failed to create Telegram account link");
    return mapRow(created);
  });
}

export async function unlinkTelegramAccountFromUser(userId: number): Promise<boolean> {
  await ensureTelegramIdentitySchemaReady();
  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) return false;

  const rows = await db
    .delete(userTelegramAccounts)
    .where(and(eq(userTelegramAccounts.userId, safeUserId)))
    .returning({ id: userTelegramAccounts.id });

  return rows.length > 0;
}
