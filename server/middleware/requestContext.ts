import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { log } from "../lib/logger";

const SLOW_MS = 300;

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = crypto.randomBytes(8).toString("hex");
  (req as Request & { requestId?: string }).requestId = requestId;
  const start = Date.now();

  let capturedJson: Record<string, unknown> | undefined;

  const originalJson = res.json.bind(res);
  res.json = function (body?: unknown) {
    if (body && typeof body === "object" && !Array.isArray(body)) {
      capturedJson = body as Record<string, unknown>;
    }
    return originalJson.call(res, body);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      if (duration > SLOW_MS) {
        log("info", `[SLOW] ${req.method} ${req.path} ${duration}ms`, { reqId: requestId, duration });
      }
      const msg = `${req.method} ${req.path} ${res.statusCode} in ${duration}ms`;
      log("info", msg, { reqId: requestId, capturedJson });
    }
  });

  next();
}
