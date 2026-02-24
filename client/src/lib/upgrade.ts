/**
 * Upgrade-required error for plan gating.
 * Thrown when API returns 402 with code UPGRADE_REQUIRED.
 */

export interface UpgradeRequiredPayload {
  code: "UPGRADE_REQUIRED";
  feature: string;
  message: string;
  limits?: { current?: number; max?: number; [key: string]: unknown };
}

export class UpgradeRequiredError extends Error {
  readonly payload: UpgradeRequiredPayload;

  constructor(payload: UpgradeRequiredPayload) {
    super(payload.message);
    this.name = "UpgradeRequiredError";
    this.payload = payload;
  }
}

/** Parse error response; throw UpgradeRequiredError if 402 + UPGRADE_REQUIRED. */
export async function checkUpgradeRequired(res: Response): Promise<void> {
  if (res.status !== 402) return;
  const body = await res.json().catch(() => ({}));
  if (body?.code === "UPGRADE_REQUIRED") {
    throw new UpgradeRequiredError(body as UpgradeRequiredPayload);
  }
}
