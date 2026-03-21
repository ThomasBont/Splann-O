import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveSessionSecret } from "../../config/env";

const TELEGRAM_PLAN_PREFIX = "plan";

function signPlanId(planId: number) {
  return createHmac("sha256", resolveSessionSecret())
    .update(`${TELEGRAM_PLAN_PREFIX}:${planId}`)
    .digest("hex")
    .slice(0, 16);
}

export function createTelegramPlanStartPayload(planId: number) {
  if (!Number.isInteger(planId) || planId <= 0) {
    throw new Error("Plan id must be a positive integer");
  }
  return `${TELEGRAM_PLAN_PREFIX}_${planId}_${signPlanId(planId)}`;
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseTelegramPlanStartPayload(payload: string | null | undefined): { planId: number } | null {
  const value = String(payload ?? "").trim();
  if (!value) return null;

  const signedMatch = /^plan_(\d+)_([a-f0-9]{16})$/i.exec(value);
  if (signedMatch) {
    const planId = Number(signedMatch[1]);
    if (!Number.isInteger(planId) || planId <= 0) return null;
    const signature = signedMatch[2].toLowerCase();
    const expected = signPlanId(planId);
    return safeEquals(signature, expected) ? { planId } : null;
  }

  if (process.env.NODE_ENV !== "production") {
    const legacyMatch = /^plan_(\d+)$/i.exec(value);
    if (legacyMatch) {
      const planId = Number(legacyMatch[1]);
      if (Number.isInteger(planId) && planId > 0) {
        return { planId };
      }
    }
  }

  return null;
}
