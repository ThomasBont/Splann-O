import { computeSplit } from "@shared/lib/split/calc";
import { bbqRepo } from "../repositories/bbqRepo";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { broadcastEventRealtime } from "./eventRealtime";

export type PlanBalancesRealtimePayload = {
  type: "plan:balancesUpdated";
  planId: number;
  balances: Array<{ id: number; name: string; paid: number; balance: number }>;
  suggestedPaybacks: Array<{ from: string; to: string; amount: number }>;
  updatedAt: string;
  version: number;
};

export function parseIncludedUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

export function buildEffectiveExpenseShares(params: {
  participants: Array<{ id: number }>;
  expenses: Array<{ id: number; includedUserIds?: string[] | null }>;
  legacyShares: Array<{ expenseId: number; participantId: number }>;
  allowOptInExpenses: boolean;
}): Array<{ expenseId: number; participantId: number }> {
  const { participants, expenses, legacyShares, allowOptInExpenses } = params;
  const participantIds = participants.map((participant) => participant.id);
  const hasCustomSplit = expenses.some((expense) => parseIncludedUserIds(expense.includedUserIds).length > 0);
  const legacyByExpense = new Map<number, number[]>();
  for (const share of legacyShares) {
    const current = legacyByExpense.get(share.expenseId);
    if (current) current.push(share.participantId);
    else legacyByExpense.set(share.expenseId, [share.participantId]);
  }

  const rows: Array<{ expenseId: number; participantId: number }> = [];
  for (const expense of expenses) {
    const parsedIncludedIds = parseIncludedUserIds(expense.includedUserIds);
    if (parsedIncludedIds.length > 0) {
      const ids = parsedIncludedIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && participantIds.includes(value));
      for (const participantId of ids) rows.push({ expenseId: expense.id, participantId });
      continue;
    }
    if (allowOptInExpenses) {
      const legacy = legacyByExpense.get(expense.id) ?? [];
      for (const participantId of legacy) rows.push({ expenseId: expense.id, participantId });
      continue;
    }
    if (hasCustomSplit) {
      for (const participantId of participantIds) rows.push({ expenseId: expense.id, participantId });
    }
  }
  return rows;
}

export async function buildPlanBalancesSnapshot(planId: number): Promise<PlanBalancesRealtimePayload | null> {
  const bbq = await bbqRepo.getById(planId);
  if (!bbq) return null;

  const [participants, expenses, shares] = await Promise.all([
    participantRepo.listByBbq(planId, "accepted"),
    expenseRepo.listByBbq(planId),
    bbq.allowOptInExpenses ? expenseRepo.getExpenseShares(planId) : Promise.resolve([]),
  ]);

  const effectiveShares = buildEffectiveExpenseShares({
    participants,
    expenses,
    legacyShares: shares,
    allowOptInExpenses: !!bbq.allowOptInExpenses,
  });
  const shouldUseCustomSplit = !!bbq.allowOptInExpenses || expenses.some((expense) => Array.isArray(expense.includedUserIds));

  const split = computeSplit(
    participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
    })),
    expenses.map((expense) => ({
      id: expense.id,
      participantId: expense.participantId,
      amount: Number(expense.amount),
    })),
    effectiveShares,
    shouldUseCustomSplit,
  );

  return {
    type: "plan:balancesUpdated",
    planId,
    balances: split.balances,
    suggestedPaybacks: split.settlements,
    updatedAt: new Date().toISOString(),
    version: Date.now(),
  };
}

export async function broadcastPlanBalancesUpdated(planId: number): Promise<void> {
  const snapshot = await buildPlanBalancesSnapshot(planId);
  if (!snapshot) return;
  if (process.env.NODE_ENV !== "production") {
    console.log("[realtime:balances:broadcast]", {
      planId,
      balances: snapshot.balances.length,
      suggestedPaybacks: snapshot.suggestedPaybacks.length,
      version: snapshot.version,
    });
  }
  broadcastEventRealtime(planId, snapshot);
}
