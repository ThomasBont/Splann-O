import type { Request, Response, NextFunction } from "express";
import { unauthorized } from "../lib/errors";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    throw unauthorized("Not authenticated");
  }
  next();
}
