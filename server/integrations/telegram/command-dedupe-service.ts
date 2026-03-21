import { pool } from "../../db";

let telegramCommandDedupeSchemaReadyPromise: Promise<void> | null = null;

async function ensureTelegramCommandDedupeSchemaReady(): Promise<void> {
  if (!telegramCommandDedupeSchemaReadyPromise) {
    telegramCommandDedupeSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS telegram_command_receipts (
          id serial PRIMARY KEY,
          telegram_chat_id text NOT NULL,
          telegram_message_id bigint NOT NULL,
          command text,
          created_at timestamp DEFAULT now(),
          UNIQUE (telegram_chat_id, telegram_message_id)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS telegram_command_receipts_created_at_idx
          ON telegram_command_receipts(created_at)
      `);
    })().catch((error) => {
      telegramCommandDedupeSchemaReadyPromise = null;
      throw error;
    });
  }
  return telegramCommandDedupeSchemaReadyPromise;
}

export async function claimTelegramCommandReceipt(input: {
  chatId: number | string;
  messageId: number;
  command: string;
}): Promise<boolean> {
  await ensureTelegramCommandDedupeSchemaReady();
  const chatId = String(input.chatId ?? "").trim();
  const messageId = Number(input.messageId);
  const command = String(input.command ?? "").trim() || null;

  if (!chatId) return false;
  if (!Number.isInteger(messageId) || messageId <= 0) return false;

  const result = await pool.query(
    `
      INSERT INTO telegram_command_receipts (
        telegram_chat_id,
        telegram_message_id,
        command,
        created_at
      ) VALUES ($1, $2, $3, now())
      ON CONFLICT (telegram_chat_id, telegram_message_id) DO NOTHING
      RETURNING id
    `,
    [chatId, messageId, command],
  );
  return result.rowCount > 0;
}
