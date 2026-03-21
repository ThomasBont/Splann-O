import { Router, type Request } from "express";
import { z } from "zod";
import { resolveTelegramBotUsername } from "../config/env";
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
  const divider = path.includes("?") ? "&" : "?";
  return `${path}${divider}telegramLink=${status}`;
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
  });
}));

router.get("/me/integrations/telegram-account/callback", asyncHandler(async (req, res) => {
  const redirectPath = sanitizeRedirectPath(req.query.redirect);
  const sessionUserId = req.session?.userId;
  if (!sessionUserId) {
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
      userId: sessionUserId,
      telegramUserId: verified.telegramUserId,
      username: verified.username,
      firstName: verified.firstName,
      lastName: verified.lastName,
      photoUrl: verified.photoUrl,
    });
    res.redirect(withStatusQuery(redirectPath, "linked"));
  } catch (error) {
    log("warn", "telegram_account_link_failed", {
      userId: sessionUserId,
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
