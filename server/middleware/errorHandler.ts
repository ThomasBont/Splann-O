import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, errorResponse } from "../lib/errors";
import { log } from "../lib/logger";

const isProd = process.env.NODE_ENV === "production";

function sanitizeStatus(status: number): number {
  if (Number.isFinite(status) && status >= 400 && status <= 599) return status;
  return 500;
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    res.status(err.status).json(errorResponse(err));
    return;
  }

  if (err instanceof ZodError) {
    const first = err.errors[0];
    const message = first ? `${first.path.join(".")}: ${first.message}` : "Validation failed";
    const body: { code: string; message: string; details?: unknown } = { code: "VALIDATION_ERROR", message };
    if (!isProd) body.details = err.errors;
    res.status(400).json(body);
    return;
  }

  const errMessage = err instanceof Error ? err.message : "Internal Server Error";
  const errStack = err instanceof Error ? err.stack : undefined;
  log("error", errMessage, {
    reqId: (req as Request & { requestId?: string }).requestId,
    method: req.method,
    path: req.path,
    message: errMessage,
    stack: errStack,
  });

  const rawStatus = (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode ?? 500;
  const status = sanitizeStatus(rawStatus);
  const message = isProd ? "Internal Server Error" : errMessage;
  res.status(status).json({ code: "INTERNAL_ERROR", message });
}
