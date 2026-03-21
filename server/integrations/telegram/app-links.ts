import { resolveTelegramAppBaseUrl } from "../../config/env";

function normalizePlanId(planId: number) {
  const safePlanId = Number(planId);
  if (!Number.isInteger(safePlanId) || safePlanId <= 0) {
    throw new Error("Plan id must be a positive integer");
  }
  return safePlanId;
}

function buildPlanUrl(planId: number, panel?: "crew" | "expenses" | "settlement") {
  const safePlanId = normalizePlanId(planId);
  const url = new URL(`/app/e/${safePlanId}`, resolveTelegramAppBaseUrl());
  if (panel) {
    url.searchParams.set("panel", panel);
    url.searchParams.set("source", "telegram");
  }
  return url.toString();
}

export function createTelegramAppLinks(planId: number) {
  return {
    openPlanUrl: buildPlanUrl(planId),
    inviteFriendsUrl: buildPlanUrl(planId, "crew"),
    viewExpensesUrl: buildPlanUrl(planId, "expenses"),
    settleUrl: buildPlanUrl(planId, "settlement"),
  };
}

export function createTelegramAppHomeUrl() {
  return new URL("/app/private", resolveTelegramAppBaseUrl()).toString();
}
