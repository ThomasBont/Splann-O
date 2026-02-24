/**
 * Verification harness for split calculations.
 * Run: npx tsx client/src/lib/split/calc.verify.ts
 */

import {
  computeSplit,
  getFairShareForParticipant,
  getParticipantsInExpense,
  type SplitParticipant,
  type SplitExpense,
  type ExpenseShareEntry,
} from "./calc";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function approx(a: number, b: number, eps = 0.01): boolean {
  return Math.abs(a - b) < eps;
}

const participants: SplitParticipant[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Carol" },
];

const expenses: SplitExpense[] = [
  { id: 1, participantId: 1, amount: 60 }, // Alice paid 60
  { id: 2, participantId: 2, amount: 30 }, // Bob paid 30
  { id: 3, participantId: 3, amount: 0 },   // Carol paid 0
];

// Equal split: 90 / 3 = 30 each. Alice +30, Bob 0, Carol -30.
// Settlement: Carol pays Alice 30.
(function testEqualSplit() {
  const { balances, settlements } = computeSplit(participants, expenses, [], false);
  assert(balances.length === 3, "3 balances");
  const alice = balances.find((b) => b.name === "Alice");
  const bob = balances.find((b) => b.name === "Bob");
  const carol = balances.find((b) => b.name === "Carol");
  assert(!!alice && approx(alice.balance, 30), "Alice +30");
  assert(!!bob && approx(bob.balance, 0), "Bob 0");
  assert(!!carol && approx(carol.balance, -30), "Carol -30");
  assert(settlements.length === 1, "1 settlement");
  assert(settlements[0].from === "Carol" && settlements[0].to === "Alice" && approx(settlements[0].amount, 30), "Carol pays Alice 30");
  console.log("✓ Equal split");
})();

// Opt-in: only Alice and Bob share expense 1. Carol not in any.
// Expense 1: 60 split 2 ways = 30 each for Alice, Bob. Carol 0 fair share for that.
// All expenses: 60 + 30 + 0 = 90. But Carol not in any -> fair share 0. Alice and Bob share.
// Actually: expense 1 (60) -> Alice, Bob. Expense 2 (30) -> if no shares, default is all? The getParticipantsInExpense when allowOptIn and forExp.length===0 returns [].
// So expense 2 with no shares = no one opted in = 0 fair share from that expense.
// Expense 3: 0, no shares = 0.
// So only expense 1 has shares. We need to add shares for expense 1: Alice and Bob.
const shares: ExpenseShareEntry[] = [
  { expenseId: 1, participantId: 1 },
  { expenseId: 1, participantId: 2 },
];
// Fair share: Alice 30, Bob 30, Carol 0. Paid: Alice 60, Bob 30, Carol 0. Balance: Alice +30, Bob 0, Carol 0.
(function testOptIn() {
  const { balances, settlements } = computeSplit(participants, expenses, shares, true);
  const alice = balances.find((b) => b.name === "Alice");
  const carol = balances.find((b) => b.name === "Carol");
  assert(!!alice && approx(alice.balance, 30), "Alice +30 (opt-in)");
  assert(!!carol && approx(carol.balance, 0), "Carol 0 (not in expense)");
  assert(settlements.length === 1, "Carol pays no one; Alice gets 30 from someone - Bob? No, Bob is 0. So only Alice +30. Who pays? No one has negative. Wait.");
  // Carol 0, Bob 0, Alice +30. No debtor! So settlements = [].
  assert(settlements.length === 0, "No debtors (Alice +30, Bob 0, Carol 0)");
  console.log("✓ Opt-in (Carol excluded)");
})();

// Empty participants
(function testEmpty() {
  const { balances, settlements } = computeSplit([], expenses, [], false);
  assert(balances.length === 0 && settlements.length === 0, "Empty when no participants");
  console.log("✓ Empty participants");
})();

// getParticipantsInExpense: no shares, allowOptIn -> []
(function testGetParticipantsInExpense() {
  const ids = getParticipantsInExpense(1, [], participants, true);
  assert(ids.length === 0, "No shares -> empty");
  const idsAll = getParticipantsInExpense(1, [], participants, false);
  assert(idsAll.length === 3, "!allowOptIn -> all");
  console.log("✓ getParticipantsInExpense");
})();

console.log("\nAll split calc verifications passed.");
