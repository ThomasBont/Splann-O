/**
 * Standardized API errors for plan gating.
 */

import type { Response } from "express";

export interface UpgradeRequiredDetails {
  current?: number;
  max?: number;
  [key: string]: unknown;
}

/**
 * Send "Upgrade required" response. Uses 402 for payment-required semantics.
 * Client can detect code === "UPGRADE_REQUIRED" for consistent handling.
 */
export function upgradeRequired(
  res: Response,
  featureKey: string,
  details?: UpgradeRequiredDetails
): Response {
  return res.status(402).json({
    code: "UPGRADE_REQUIRED",
    feature: featureKey,
    message: "Upgrade to Pro to use this feature.",
    limits: details ?? undefined,
  });
}
