import rateLimit from "express-rate-limit";
import type { Request } from "express";

const standardHeaders = true;
const legacyHeaders = false;

const RATE_LIMIT_MESSAGE = { message: "Too many requests. Please try again later." };

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

function scopedKey(prefix: string, req: Request): string {
  const userId = req.session?.userId ?? "anon";
  return `${prefix}:${userId}:${getClientIp(req)}`;
}

function createScopedLimiter(options: {
  prefix: string;
  windowMs: number;
  max: number;
  code: string;
  message: string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders,
    legacyHeaders,
    keyGenerator: (req: Request) => scopedKey(options.prefix, req),
    handler: (_req, res) => {
      res.status(429).json({
        code: options.code,
        message: options.message,
      });
    },
  });
}

/** Login: 10 requests per minute per IP */
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders,
  legacyHeaders,
  message: RATE_LIMIT_MESSAGE,
});

/** Forgot & reset password: 5 requests per minute per IP */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders,
  legacyHeaders,
  message: RATE_LIMIT_MESSAGE,
});

/** User search: 60 requests per 10 seconds, keyed by userId + IP */
export const usersSearchLimiter = rateLimit({
  windowMs: 10_000,
  max: 60,
  standardHeaders,
  legacyHeaders,
  keyGenerator: (req: Request) => scopedKey("search", req),
  handler: (_req, res) => {
    res.status(429).json({
      code: "USERS_SEARCH_RATE_LIMITED",
      message: "Too many search requests. Try again shortly.",
    });
  },
});

export const receiptScanLimiter = createScopedLimiter({
  prefix: "receipt-scan",
  windowMs: 60 * 1000,
  max: 12,
  code: "RECEIPT_SCAN_RATE_LIMITED",
  message: "Too many receipt scans. Try again shortly.",
});

export const receiptUploadLimiter = createScopedLimiter({
  prefix: "receipt-upload",
  windowMs: 10 * 60 * 1000,
  max: 30,
  code: "RECEIPT_UPLOAD_RATE_LIMITED",
  message: "Too many receipt uploads. Try again later.",
});

export const photoUploadLimiter = createScopedLimiter({
  prefix: "photo-upload",
  windowMs: 10 * 60 * 1000,
  max: 30,
  code: "PHOTO_UPLOAD_RATE_LIMITED",
  message: "Too many photo uploads. Try again later.",
});

export const chatMessageLimiter = createScopedLimiter({
  prefix: "chat-message",
  windowMs: 10 * 1000,
  max: 40,
  code: "CHAT_MESSAGE_RATE_LIMITED",
  message: "You're sending messages too quickly. Try again in a moment.",
});

export const chatAttachmentLimiter = createScopedLimiter({
  prefix: "chat-attachment",
  windowMs: 5 * 60 * 1000,
  max: 20,
  code: "CHAT_ATTACHMENT_RATE_LIMITED",
  message: "Too many attachment uploads. Try again later.",
});

export const settlementActionLimiter = createScopedLimiter({
  prefix: "settlement-action",
  windowMs: 60 * 1000,
  max: 20,
  code: "SETTLEMENT_ACTION_RATE_LIMITED",
  message: "Too many settlement actions. Try again shortly.",
});

export const checkoutLimiter = createScopedLimiter({
  prefix: "checkout",
  windowMs: 60 * 1000,
  max: 15,
  code: "CHECKOUT_RATE_LIMITED",
  message: "Too many payment attempts. Try again shortly.",
});
