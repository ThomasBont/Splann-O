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

const CENTS = 100;

function toCents(amount: number): number {
  return Math.round(amount * CENTS);
}

function fromCents(cents: number): number {
  return cents / CENTS;
}

function allocateEvenly(totalCents: number, participantIds: number[]): Map<number, number> {
  const allocation = new Map<number, number>();
  if (participantIds.length === 0) return allocation;

  const base = Math.trunc(totalCents / participantIds.length);
  let remainder = totalCents - base * participantIds.length;
  for (const participantId of participantIds) {
    const adjust = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    allocation.set(participantId, base + adjust);
    if (adjust !== 0) remainder -= adjust;
  }
  return allocation;
}

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
  const forExpense = expenseShares.filter((share) => share.expenseId === expenseId);
  if (forExpense.length === 0) {
    if (allowOptIn) return [];
    return participants.map((participant) => participant.id);
  }
  return forExpense.map((share) => share.participantId);
}

function computeFairShareByParticipantCents(
  participants: SplitParticipant[],
  expenses: SplitExpense[],
  expenseShares: ExpenseShareEntry[],
  allowOptIn: boolean,
): Map<number, number> {
  const fairShareByParticipant = new Map<number, number>();
  const participantIds = participants.map((participant) => participant.id);
  for (const participantId of participantIds) fairShareByParticipant.set(participantId, 0);

  if (!allowOptIn || expenseShares.length === 0) {
    const totalCents = expenses.reduce((sum, expense) => sum + toCents(expense.amount), 0);
    const perParticipant = allocateEvenly(totalCents, participantIds);
    perParticipant.forEach((cents, participantId) => {
      fairShareByParticipant.set(participantId, cents);
    });
    return fairShareByParticipant;
  }

  for (const expense of expenses) {
    const participantIdsInExpense = [...getParticipantsInExpense(expense.id, expenseShares, participants, true)].sort((a, b) => a - b);
    if (participantIdsInExpense.length === 0) continue;
    const perParticipant = allocateEvenly(toCents(expense.amount), participantIdsInExpense);
    perParticipant.forEach((cents, participantId) => {
      fairShareByParticipant.set(participantId, (fairShareByParticipant.get(participantId) ?? 0) + cents);
    });
  }

  return fairShareByParticipant;
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
  const fairShareByParticipant = computeFairShareByParticipantCents(participants, expenses, expenseShares, allowOptIn);
  return fromCents(fairShareByParticipant.get(participantId) ?? 0);
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
  const paidByParticipant = new Map<number, number>();
  for (const participant of participants) paidByParticipant.set(participant.id, 0);

  for (const expense of expenses) {
    paidByParticipant.set(
      expense.participantId,
      (paidByParticipant.get(expense.participantId) ?? 0) + toCents(expense.amount),
    );
  }

  const fairShareByParticipant = computeFairShareByParticipantCents(participants, expenses, expenseShares, allowOptIn);

  return participants.map((participant) => {
    const paidCents = paidByParticipant.get(participant.id) ?? 0;
    const fairShareCents = fairShareByParticipant.get(participant.id) ?? 0;
    return {
      id: participant.id,
      name: participant.name,
      paid: fromCents(paidCents),
      balance: fromCents(paidCents - fairShareCents),
    };
  });
}

/**
 * Compute settlement plan: minimal transfers from debtors to creditors.
 * Greedy algorithm over cents, so rounding is deterministic.
 */
export function computeSettlementPlan(balances: Balance[]): Settlement[] {
  const debtors = balances
    .map((balance) => ({ ...balance, cents: toCents(balance.balance) }))
    .filter((balance) => balance.cents < 0)
    .sort((a, b) => a.cents - b.cents)
    .map((balance) => ({ ...balance }));

  const creditors = balances
    .map((balance) => ({ ...balance, cents: toCents(balance.balance) }))
    .filter((balance) => balance.cents > 0)
    .sort((a, b) => b.cents - a.cents)
    .map((balance) => ({ ...balance }));

  const settlements: Settlement[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const transferCents = Math.min(Math.abs(debtor.cents), creditor.cents);

    if (transferCents > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: fromCents(transferCents),
      });
      debtor.cents += transferCents;
      creditor.cents -= transferCents;
    }

    if (Math.abs(debtor.cents) <= 0) debtorIndex += 1;
    if (Math.abs(creditor.cents) <= 0) creditorIndex += 1;
  }

  return settlements;
}

function assertBalanceInvariants(balances: Balance[]) {
  const sumNetCents = balances.reduce((sum, balance) => sum + toCents(balance.balance), 0);
  const positiveCents = balances.reduce((sum, balance) => sum + Math.max(0, toCents(balance.balance)), 0);
  const negativeCentsAbs = balances.reduce((sum, balance) => sum + Math.abs(Math.min(0, toCents(balance.balance))), 0);
  console.assert(Math.abs(sumNetCents) <= 1, `[split] sum(net) drifted by ${sumNetCents} cents`);
  console.assert(Math.abs(positiveCents - negativeCentsAbs) <= 1, `[split] positive/negative mismatch (+${positiveCents}, -${negativeCentsAbs})`);
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
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    assertBalanceInvariants(balances);
  }
  const settlements = computeSettlementPlan(balances);
  return { balances, settlements };
}
