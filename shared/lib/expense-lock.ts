type ExpenseLockInput = {
  planStatus?: string | null;
  settlementStarted?: boolean | null;
  linkedSettlementRoundId?: string | null;
  settledAt?: string | Date | null;
  excludedFromFinalSettlement?: boolean | null;
  resolutionMode?: string | null;
};

export type ExpenseLockState = {
  locked: boolean;
  reason:
    | "none"
    | "active_settlement"
    | "finalized_settlement"
    | "expense_settlement_linked";
  message: string | null;
  shortLabel: string | null;
};

function normalizePlanStatus(status?: string | null): "active" | "closed" | "settled" | "archived" {
  if (status === "archived") return "archived";
  if (status === "settled") return "settled";
  if (status === "closed") return "closed";
  return "active";
}

export function getExpenseLockState(input: ExpenseLockInput): ExpenseLockState {
  const planStatus = normalizePlanStatus(input.planStatus);
  const linkedSettlementRoundId = String(input.linkedSettlementRoundId ?? "").trim();
  const hasExpenseSettlementLink =
    !!linkedSettlementRoundId
    || !!input.settledAt
    || !!input.excludedFromFinalSettlement
    || String(input.resolutionMode ?? "").trim().toLowerCase() === "now";

  if (planStatus === "settled" || planStatus === "archived") {
    return {
      locked: true,
      reason: "finalized_settlement",
      message: "This expense is locked because settlement has already been finalized.",
      shortLabel: "Locked after settlement",
    };
  }

  if (input.settlementStarted) {
    return {
      locked: true,
      reason: "active_settlement",
      message: "This expense is locked because settlement is already in progress.",
      shortLabel: "Locked during settlement",
    };
  }

  if (hasExpenseSettlementLink) {
    return {
      locked: true,
      reason: "expense_settlement_linked",
      message: "This expense is locked because it is already part of settlement.",
      shortLabel: "Locked after settlement",
    };
  }

  return {
    locked: false,
    reason: "none",
    message: null,
    shortLabel: null,
  };
}

export function canModifyExpense(input: ExpenseLockInput): boolean {
  return !getExpenseLockState(input).locked;
}
