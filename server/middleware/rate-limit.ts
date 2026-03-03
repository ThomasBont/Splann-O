import rateLimit from "express-rate-limit";
import type { Request } from "express";

const standardHeaders = true;
const legacyHeaders = false;

const RATE_LIMIT_MESSAGE = { message: "Too many requests. Please try again later." };

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
  keyGenerator: (req: Request) => {
    const userId = req.session?.userId ?? "anon";
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() ??
      req.socket.remoteAddress ??
      "unknown";
    return `search:${userId}:${ip}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      code: "USERS_SEARCH_RATE_LIMITED",
      message: "Too many search requests. Try again shortly.",
    });
  },
});
