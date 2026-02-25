/**
 * Standardized API errors. Services throw AppError; errorHandler converts to JSON.
 */

import type { Response } from "express";

export interface UpgradeRequiredDetails {
  current?: number;
  max?: number;
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function badRequest(message: string, details?: Record<string, unknown>): never {
  throw new AppError("BAD_REQUEST", message, 400, details);
}

export function unauthorized(message = "Not authenticated"): never {
  throw new AppError("UNAUTHORIZED", message, 401);
}

export function forbidden(message = "Forbidden"): never {
  throw new AppError("FORBIDDEN", message, 403);
}

export function notFound(message = "Not found"): never {
  throw new AppError("NOT_FOUND", message, 404);
}

export function gone(message = "Gone"): never {
  throw new AppError("GONE", message, 410);
}

export function conflict(message: string): never {
  throw new AppError("CONFLICT", message, 409);
}

export function upgradeRequired(
  featureKey: string,
  details?: UpgradeRequiredDetails
): never {
  throw new AppError(
    "UPGRADE_REQUIRED",
    "Upgrade to Pro to use this feature.",
    402,
    { feature: featureKey, limits: details }
  );
}

/** Standard JSON error response shape. */
export function errorResponse(err: AppError): Record<string, unknown> {
  const base: Record<string, unknown> = { code: err.code, message: err.message };
  if (err.code === "UPGRADE_REQUIRED" && err.details) {
    return { ...base, feature: err.details.feature, limits: err.details.limits };
  }
  if (err.details) base.details = err.details;
  return base;
}
