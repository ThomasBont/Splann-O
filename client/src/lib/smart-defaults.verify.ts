import { resolveExpenseDefaults, type SmartGroupDefaults, type SmartGroupStats } from "./smart-defaults";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const members = [
  { id: 1, userId: "alice", name: "Alice" },
  { id: 2, userId: "bob", name: "Bob" },
  { id: 3, userId: "carol", name: "Carol" },
];

const defaults: SmartGroupDefaults = {
  groupId: 42,
  currencyCode: "EUR",
  splitMethod: "equally",
  lastParticipantIds: [2, 2, 99, 1, 1],
  payerUserId: "bob",
  lastPayerParticipantId: 2,
  updatedAt: Date.now(),
};

const stats: SmartGroupStats = {
  groupId: 42,
  payerCountByUserId: { bob: 5, alice: 4 },
  recentPayerUserIds: ["alice", "bob"],
  recentPayerParticipantIds: [1, 2],
  participantPickCount: { "2": 5, "3": 2, "1": 1 },
  updatedAt: Date.now(),
};

const resolved = resolveExpenseDefaults({
  groupId: 42,
  currentUserId: "alice",
  groupMembers: members,
  storedDefaults: defaults,
  storedStats: stats,
  groupHomeCurrencyCode: "USD",
  appDefaultCurrencyCode: "GBP",
});

assert(resolved.currencyCode === "EUR", "should prefer stored group currency");
assert(resolved.payerParticipantId === 1, "recency should win when payer counts are close");
assert(resolved.payerSuggestionSource === "lastUsed", "should prefer recent last-used payer when counts are close");
assert(resolved.lastParticipantIds.join(",") === "2,1", "should dedupe and drop unknown participants from last set");
assert(resolved.orderedParticipantIds[0] === 1, "should keep current user first for convenience");
assert(
  resolved.orderedParticipantIds.indexOf(2) < resolved.orderedParticipantIds.indexOf(3),
  "higher participant pick count should rank earlier after current user"
);
assert(resolved.splitMethod === "equally", "should default split method");

const fallback = resolveExpenseDefaults({
  groupId: 7,
  currentUserId: "nobody",
  groupMembers: [{ id: 10, name: "Solo" }],
  groupHomeCurrencyCode: "CHF",
});

assert(fallback.currencyCode === "CHF", "should fall back to group home currency");
assert(fallback.payerParticipantId === 10, "single-member group should default to only member");
assert(fallback.payerSuggestionSource === "fallback", "fallback payer should not report smart suggestion");

const recencyWins = resolveExpenseDefaults({
  groupId: 9,
  currentUserId: "alice",
  groupMembers: members,
  storedDefaults: {
    groupId: 9,
    payerUserId: "bob",
    lastPayerParticipantId: 2,
    updatedAt: Date.now(),
  },
  storedStats: {
    groupId: 9,
    payerCountByUserId: { bob: 4, alice: 5 },
    recentPayerUserIds: ["bob", "alice"],
    updatedAt: Date.now(),
  },
});
assert(recencyWins.payerParticipantId === 2, "last-used payer should beat most-common when counts are close");
assert(recencyWins.payerSuggestionSource === "lastUsed", "recency selection should be marked lastUsed");

const frequencyWins = resolveExpenseDefaults({
  groupId: 10,
  currentUserId: "alice",
  groupMembers: members,
  storedStats: {
    groupId: 10,
    payerCountByUserId: { alice: 8, bob: 1 },
    recentPayerUserIds: ["bob", "alice"],
    recentPayerParticipantIds: [2, 1],
    updatedAt: Date.now(),
  },
});
assert(frequencyWins.payerParticipantId === 1, "most-common payer should win when frequency is strongly higher");
assert(frequencyWins.payerSuggestionSource === "mostCommon", "frequency-driven selection should be marked mostCommon");

console.log("smart-defaults.verify: ok");
