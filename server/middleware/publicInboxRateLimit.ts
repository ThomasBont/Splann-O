import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

// Per-conversation limit: 1 message per 10 minutes for unapproved senders.
const perConversationLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.session?.userId ?? "anon";
    const conversationId = req.params.conversationId ?? "unknown";
    return `inbox-conv:${userId}:${conversationId}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many messages right now. Please try again later.",
    });
  },
});

// Per-user limit: 3 messages per hour for unapproved senders.
const perUserLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.session?.userId ?? "anon";
    return `inbox-user:${userId}`;
  },
  handler: (_req, res) => {
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many messages right now. Please try again later.",
    });
  },
});

/**
 * Middleware that applies inbox rate limits only to unapproved senders.
 * Approved senders (req.inboxApproved === true) are not limited.
 * Attach req.inboxApproved = true before this middleware for approved users.
 */
export function publicInboxRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if ((req as Request & { inboxApproved?: boolean }).inboxApproved) {
    return next();
  }
  perConversationLimiter(req, res, (err?: unknown) => {
    if (err) return next(err);
    perUserLimiter(req, res, next);
  });
}

/** @deprecated Use publicInboxRateLimit middleware instead */
export function checkPublicInboxRateLimit(_input: {
  userId: number;
  conversationId: string;
  approved: boolean;
}): { ok: true } {
  return { ok: true };
}
