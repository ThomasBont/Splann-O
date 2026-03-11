export type ClientPlanStatus = "active" | "closed" | "settled";

export function getClientPlanStatus(status?: string | null): ClientPlanStatus {
  if (status === "settled") return "settled";
  if (status === "closed") return "closed";
  return "active";
}

export function isPlanSettled(status?: string | null) {
  return getClientPlanStatus(status) === "settled";
}

export function isPlanClosed(status?: string | null) {
  return getClientPlanStatus(status) === "closed";
}

export function isPlanReadOnly(status?: string | null) {
  return getClientPlanStatus(status) !== "active";
}
