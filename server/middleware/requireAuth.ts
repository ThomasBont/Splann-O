import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ code: "NOT_AUTHENTICATED", message: "Not authenticated" });
    return;
  }
  next();
}
