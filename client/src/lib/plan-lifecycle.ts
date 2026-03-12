const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export type ClientPlanStatus = "active" | "closed" | "settled" | "archived";

export function getClientPlanStatus(status?: string | null): ClientPlanStatus {
  if (status === "archived") return "archived";
  if (status === "settled") return "settled";
  if (status === "closed") return "closed";
  return "active";
}

export function getPlanWrapUpEndsAt(settledAt?: string | Date | null) {
  if (!settledAt) return null;
  const date = settledAt instanceof Date ? settledAt : new Date(settledAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + TWO_DAYS_MS);
}

export function isPlanInWrapUp(status?: string | null, settledAt?: string | Date | null, now = new Date()) {
  const normalized = getClientPlanStatus(status);
  if (normalized !== "settled") return false;
  const endsAt = getPlanWrapUpEndsAt(settledAt);
  if (!endsAt) return false;
  return now.getTime() <= endsAt.getTime();
}

export function isPlanSettled(status?: string | null) {
  return getClientPlanStatus(status) === "settled";
}

export function isPlanClosed(status?: string | null) {
  return getClientPlanStatus(status) === "closed";
}

export function isPlanReadOnly(status?: string | null) {
  return getClientPlanStatus(status) === "closed" || getClientPlanStatus(status) === "archived";
}
