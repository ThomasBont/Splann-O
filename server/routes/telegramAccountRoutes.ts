import { Router, type Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { resolveSessionSecret, resolveTelegramBotUsername } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { log } from "../lib/logger";
import { validateTelegramAuthPayload } from "../integrations/telegram/telegram-auth-service";
import {
  getLinkedTelegramAccountForUser,
  linkTelegramAccountToUser,
  unlinkTelegramAccountFromUser,
} from "../integrations/telegram/telegram-identity-service";

const router = Router();

function asyncHandler(fn: (req: Request, res: any, next: any) => Promise<void>) {
  return (req: Request, res: any, next: any) => fn(req, res, next).catch(next);
}

function sanitizeRedirectPath(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw.startsWith("/")) return "/app";
  if (raw.startsWith("//")) return "/app";
  return raw;
}

function withStatusQuery(path: string, status: "linked" | "error" | "auth_required") {
  const parsed = new URL(path, "https://splanno.local");
  parsed.searchParams.set("telegramAccountLink", status);
  parsed.searchParams.delete("telegramLink");
  return `${parsed.pathname}${parsed.search}`;
}

function createTelegramAccountLinkToken(userId: number) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${userId}:${issuedAt}`;
  const secret = resolveSessionSecret();
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`, "utf8").toString("base64url");
}

function resolveUserIdFromLinkToken(token: unknown): number | null {
  const raw = typeof token === "string" ? token.trim() : "";
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [userIdRaw, issuedAtRaw, signature] = decoded.split(":");
    if (!userIdRaw || !issuedAtRaw || !signature) return null;
    const userId = Number(userIdRaw);
    const issuedAt = Number(issuedAtRaw);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isInteger(issuedAt) || issuedAt <= 0) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - issuedAt > 15 * 60 || issuedAt > now + 120) return null;

    const payload = `${userId}:${issuedAt}`;
    const expected = createHmac("sha256", resolveSessionSecret()).update(payload).digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== receivedBuf.length) return null;
    if (!timingSafeEqual(expectedBuf, receivedBuf)) return null;
    return userId;
  } catch {
    return null;
  }
}

router.get("/me/integrations/telegram-account", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const linked = await getLinkedTelegramAccountForUser(userId);
  res.json({
    connected: !!linked,
    account: linked
      ? {
          telegramUserId: linked.telegramUserId,
          username: linked.username,
          firstName: linked.firstName,
          lastName: linked.lastName,
          photoUrl: linked.photoUrl,
          linkedAt: linked.linkedAt?.toISOString() ?? null,
        }
      : null,
    botUsername: resolveTelegramBotUsername() || null,
    callbackPath: "/api/me/integrations/telegram-account/callback",
    linkToken: createTelegramAccountLinkToken(userId),
  });
}));

router.get("/me/integrations/telegram-account/callback", asyncHandler(async (req, res) => {
  const redirectPath = sanitizeRedirectPath(req.query.redirect);
  const sessionUserId = req.session?.userId;
  const linkTokenUserId = resolveUserIdFromLinkToken(req.query.linkToken);
  const resolvedUserId = sessionUserId ?? linkTokenUserId;
  if (!sessionUserId && linkTokenUserId) {
    log("info", "telegram_account_callback_link_token_used", {
      userId: linkTokenUserId,
    });
  }
  if (!resolvedUserId) {
    res.redirect(withStatusQuery(redirectPath, "auth_required"));
    return;
  }

  try {
    const payload = z.object({
      id: z.string().min(1),
      first_name: z.string().min(1),
      last_name: z.string().optional(),
      username: z.string().optional(),
      photo_url: z.string().optional(),
      auth_date: z.string().min(1),
      hash: z.string().min(1),
    }).parse(req.query ?? {});
    const verified = validateTelegramAuthPayload(payload);
    await linkTelegramAccountToUser({
      userId: resolvedUserId,
      telegramUserId: verified.telegramUserId,
      username: verified.username,
      firstName: verified.firstName,
      lastName: verified.lastName,
      photoUrl: verified.photoUrl,
    });
    res.redirect(withStatusQuery(redirectPath, "linked"));
  } catch (error) {
    log("warn", "telegram_account_link_failed", {
      userId: resolvedUserId,
      message: error instanceof Error ? error.message : String(error),
    });
    res.redirect(withStatusQuery(redirectPath, "error"));
  }
}));

router.delete("/me/integrations/telegram-account", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const removed = await unlinkTelegramAccountFromUser(userId);
  res.json({ ok: true, removed });
}));

export default router;
