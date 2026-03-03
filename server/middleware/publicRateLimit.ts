import rateLimit from "express-rate-limit";
import type { Request } from "express";

function clientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string | undefined)
      ?.split(",")[0]
      ?.trim() ??
    req.socket.remoteAddress ??
    "unknown"
  );
}

export function publicRateLimit(max = 60, windowMs = 60_000) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `public:${clientIp(req)}:${req.route?.path ?? req.path}`,
    handler: (_req, res) => {
      res.status(429).json({ message: "Too many requests. Please try again later." });
    },
  });
}
