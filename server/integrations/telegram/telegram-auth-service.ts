import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { badRequest } from "../../lib/errors";

export type TelegramAuthPayload = {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
};

export type VerifiedTelegramIdentity = {
  telegramUserId: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  authDate: number;
};

function normalizePayload(raw: Partial<TelegramAuthPayload>): TelegramAuthPayload {
  return {
    id: String(raw.id ?? "").trim(),
    first_name: String(raw.first_name ?? "").trim(),
    last_name: String(raw.last_name ?? "").trim() || undefined,
    username: String(raw.username ?? "").trim() || undefined,
    photo_url: String(raw.photo_url ?? "").trim() || undefined,
    auth_date: String(raw.auth_date ?? "").trim(),
    hash: String(raw.hash ?? "").trim(),
  };
}

function buildDataCheckString(payload: TelegramAuthPayload) {
  const fields: Array<[string, string]> = [
    ["auth_date", payload.auth_date],
    ["first_name", payload.first_name],
    ["id", payload.id],
  ];
  if (payload.last_name) fields.push(["last_name", payload.last_name]);
  if (payload.photo_url) fields.push(["photo_url", payload.photo_url]);
  if (payload.username) fields.push(["username", payload.username]);
  return fields
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function validateTelegramAuthPayload(
  rawPayload: Partial<TelegramAuthPayload>,
  options?: { maxAgeSeconds?: number },
): VerifiedTelegramIdentity {
  const payload = normalizePayload(rawPayload);
  if (!payload.id || !payload.first_name || !payload.auth_date || !payload.hash) {
    badRequest("Invalid Telegram auth payload.");
  }

  const authDate = Number(payload.auth_date);
  if (!Number.isInteger(authDate) || authDate <= 0) {
    badRequest("Invalid Telegram auth timestamp.");
  }

  const maxAgeSeconds = options?.maxAgeSeconds ?? 86400;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (authDate > nowSeconds + 300 || nowSeconds - authDate > maxAgeSeconds) {
    badRequest("Telegram login expired. Please try again.");
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN.");
  }

  const dataCheckString = buildDataCheckString(payload);
  const secretKey = createHash("sha256").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const expected = Buffer.from(expectedHash, "hex");
  const received = Buffer.from(payload.hash, "hex");

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    badRequest("Telegram auth signature mismatch.");
  }

  return {
    telegramUserId: payload.id,
    username: payload.username ?? null,
    firstName: payload.first_name,
    lastName: payload.last_name ?? null,
    photoUrl: payload.photo_url ?? null,
    authDate,
  };
}
