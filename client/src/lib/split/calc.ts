/**
 * Pure split/settlement calculation logic.
 * Extracted from home.tsx for testability and reuse (basic.tsx, future features).
 */

/** Participant shape used in split calculations. */
export interface SplitParticipant {
  id: number;
  name: string;
}

/** Expense shape: who paid (participantId) and amount. */
export interface SplitExpense {
  id: number;
  participantId: number;
  amount: number;
}

/** Opt-in expense share: which participants are in an expense. */
export interface ExpenseShareEntry {
  expenseId: number;
  participantId: number;
}

/** Per-participant balance (paid - fair share). */
export interface Balance {
  id: number;
  name: string;
  paid: number;
  balance: number;
}

/** A single settlement: from owes to amount. */
export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

const EPSILON = 0.01;

/**
 * Get participant IDs included in an expense.
 * When allowOptIn and shares exist: only participants with a share entry.
 * When allowOptIn and no shares: empty (expense not opted into).
 * When !allowOptIn: all participants.
 */
export function getParticipantsInExpense(
  expenseId: number,
  expenseShares: ExpenseShareEntry[],
  participants: SplitParticipant[],
  allowOptIn: boolean
): number[] {
  const forExp = expenseShares.filter((s) => s.expenseId === expenseId);
  if (forExp.length === 0) {
    if (allowOptIn) return [];
    return participants.map((p) => p.id);
  }
  return forExp.map((s) => s.participantId);
}

/**
 * Compute fair share for a participant (amount they owe toward expenses).
 * When !allowOptIn or no expense shares: equal split.
 * When allowOptIn: sum of (expense.amount / participantsInExpense) for each expense they're in.
 */
export function getFairShareForParticipant(
  participantId: number,
  expenses: SplitExpense[],
  expenseShares: ExpenseShareEntry[],
  participants: SplitParticipant[],
  allowOptIn: boolean
): number {
  if (!allowOptIn || expenseShares.length === 0) {
    return participants.length > 0
      ? expenses.reduce((s, e) => s + e.amount, 0) / participants.length
      : 0;
  }
  let sum = 0;
  for (const exp of expenses) {
    const inIds = getParticipantsInExpense(exp.id, expenseShares, participants, true);
    if (inIds.includes(participantId)) sum += exp.amount / inIds.length;
  }
  return sum;
}

/**
 * Compute per-participant balances: paid - fairShare.
 */
export function computeBalances(
  participants: SplitParticipant[],
  expenses: SplitExpense[],
  expenseShares: ExpenseShareEntry[],
  allowOptIn: boolean
): Balance[] {
  return participants.map((p) => {
    const paid = expenses
      .filter((e) => e.participantId === p.id)
      .reduce((s, e) => s + e.amount, 0);
    const fairShare = getFairShareForParticipant(p.id, expenses, expenseShares, participants, allowOptIn);
    return { id: p.id, name: p.name, paid, balance: paid - fairShare };
  });
}

/**
 * Compute settlement plan: minimal transfers from debtors to creditors.
 * Greedy algorithm: smallest debtor pays largest creditor.
 */
export function computeSettlementPlan(balances: Balance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.balance < -EPSILON)
    .sort((a, b) => a.balance - b.balance)
    .map((b) => ({ ...b }));
  const creditors = balances
    .filter((b) => b.balance > EPSILON)
    .sort((a, b) => b.balance - a.balance)
    .map((b) => ({ ...b }));

  const settlements: Settlement[] = [];
  let i = 0,
    j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(Math.abs(d.balance), c.balance);
    if (amount > EPSILON) {
      settlements.push({ from: d.name, to: c.name, amount });
      d.balance += amount;
      c.balance -= amount;
    }
    if (Math.abs(d.balance) < EPSILON) i++;
    if (c.balance < EPSILON) j++;
  }

  return settlements;
}

/**
 * All-in-one: compute balances and settlements.
 */
export function computeSplit(
  participants: SplitParticipant[],
  expenses: SplitExpense[],
  expenseShares: ExpenseShareEntry[],
  allowOptIn: boolean
): { balances: Balance[]; settlements: Settlement[] } {
  if (participants.length === 0) return { balances: [], settlements: [] };
  const balances = computeBalances(participants, expenses, expenseShares, allowOptIn);
  const settlements = computeSettlementPlan(balances);
  return { balances, settlements };
}
