import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSessionSecret } from "../../config/env";

const ACCOUNT_LINK_PREFIX = "acct";
const ACCOUNT_LINK_TTL_SECONDS = 15 * 60;

function signAccountLink(userId: number, issuedAt: number) {
  return createHmac("sha256", resolveSessionSecret())
    .update(`${ACCOUNT_LINK_PREFIX}:${userId}:${issuedAt}`)
    .digest("hex")
    .slice(0, 16);
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function createTelegramAccountStartPayload(userId: number) {
  const safeUserId = Number(userId);
  if (!Number.isInteger(safeUserId) || safeUserId <= 0) {
    throw new Error("User id must be a positive integer");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  return `${ACCOUNT_LINK_PREFIX}_${safeUserId}_${issuedAt}_${signAccountLink(safeUserId, issuedAt)}`;
}

export function parseTelegramAccountStartPayload(payload: string | null | undefined): { userId: number } | null {
  const value = String(payload ?? "").trim().toLowerCase();
  if (!value) return null;

  const match = /^acct_(\d+)_(\d+)_([a-f0-9]{16})$/.exec(value);
  if (!match) return null;

  const userId = Number(match[1]);
  const issuedAt = Number(match[2]);
  const signature = match[3];
  if (!Number.isInteger(userId) || userId <= 0) return null;
  if (!Number.isInteger(issuedAt) || issuedAt <= 0) return null;

  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now + 120) return null;
  if (now - issuedAt > ACCOUNT_LINK_TTL_SECONDS) return null;

  const expected = signAccountLink(userId, issuedAt);
  return safeEquals(signature, expected) ? { userId } : null;
}

