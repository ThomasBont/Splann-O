import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, errorResponse } from "../lib/errors";
import { log } from "../lib/logger";

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
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
    res.status(400).json({ code: "VALIDATION_ERROR", message });
    return;
  }

  log("error", err instanceof Error ? err.message : "Internal Server Error", {
    reqId: (res.req as Request & { requestId?: string }).requestId,
    stack: err instanceof Error ? err.stack : undefined,
  });

  const status = (err as { status?: number; statusCode?: number }).status ??
    (err as { status?: number; statusCode?: number }).statusCode ?? 500;
  const message = err instanceof Error ? err.message : "Internal Server Error";
  res.status(status).json({ code: "INTERNAL_ERROR", message });
}
