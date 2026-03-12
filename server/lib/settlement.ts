import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { computeSplit } from "@shared/lib/split/calc";
import { barbecues, eventSettlementRounds, eventSettlementTransfers, expenses, users } from "@shared/schema";
import { db } from "../db";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { buildEffectiveExpenseShares } from "./planBalancesRealtime";
import { postSystemChatMessage } from "./systemChat";
import { broadcastEventRealtime } from "./eventRealtime";
import { logPlanActivity } from "./planActivity";

type Transfer = {
  fromUserId: number;
  fromName: string;
  toUserId: number;
  toName: string;
  amountCents: number;
};

type SettlementRoundStatus = "active" | "completed" | "cancelled";
type SettlementScopeType = "everyone" | "selected";
type SettlementRoundType = "balance_settlement" | "direct_split";

type SettlementRoundSummary = {
  id: string;
  eventId: number;
  title: string;
  roundType: SettlementRoundType;
  scopeType: SettlementScopeType;
  selectedParticipantIds: number[] | null;
  status: SettlementRoundStatus;
  currency: string | null;
  createdByUserId: number | null;
  paidByUserId: number | null;
  paidByName: string | null;
  createdAt: string | null;
  completedAt: string | null;
  transferCount: number;
  paidTransfersCount: number;
  totalAmount: number;
  outstandingAmount: number;
};

type SettlementRoundsList = {
  activeFinalSettlementRound: SettlementRoundSummary | null;
  activeQuickSettleRound: SettlementRoundSummary | null;
  pastFinalSettlementRounds: SettlementRoundSummary[];
  pastQuickSettleRounds: SettlementRoundSummary[];
};

type SettlementRoundDetail = {
  settlement: {
    id: string;
    eventId: number;
    title: string;
    roundType: SettlementRoundType;
    scopeType: SettlementScopeType;
    selectedParticipantIds: number[] | null;
    status: SettlementRoundStatus;
    currency: string | null;
    createdByUserId: number | null;
    paidByUserId: number | null;
    paidByName: string | null;
    createdAt: string | null;
    completedAt: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    settlementRoundId: string;
    fromUserId: number;
    fromName: string;
    toUserId: number;
    toName: string;
    amountCents: number;
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
    paymentRef: string | null;
  }>;
  summary: {
    transferCount: number;
    paidTransfersCount: number;
    totalAmount: number;
    outstandingAmount: number;
  };
};

function toCents(amount: number): number {
  return Math.round((Number.isFinite(amount) ? amount : 0) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
}

function splitAmountAcrossParticipants(amountCents: number, count: number) {
  const safeCount = Math.max(1, count);
  const base = Math.floor(amountCents / safeCount);
  const remainder = amountCents % safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function isIncludedInFinalSettlement(expense: { resolutionMode?: string | null; excludedFromFinalSettlement?: boolean | null }) {
  if (expense.excludedFromFinalSettlement) return false;
  return String(expense.resolutionMode ?? "later").trim().toLowerCase() !== "now";
}

export function computeSettlementTransfers(
  balances: Array<{ userId: number; name: string; balance: number }>,
): Transfer[] {
  const creditors = balances
    .map((entry) => ({ ...entry, amountCents: toCents(entry.balance) }))
    .filter((entry) => entry.amountCents > 0)
    .map((entry) => ({ userId: entry.userId, name: entry.name, amountCents: entry.amountCents }));
  const debtors = balances
    .map((entry) => ({ ...entry, amountCents: Math.abs(toCents(entry.balance)) }))
    .filter((entry) => toCents(entry.balance) < 0 && entry.amountCents > 0)
    .map((entry) => ({ userId: entry.userId, name: entry.name, amountCents: entry.amountCents }));

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountCents = Math.min(debtor.amountCents, creditor.amountCents);
    if (amountCents > 0) {
      transfers.push({
        fromUserId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toName: creditor.name,
        amountCents,
      });
    }
    debtor.amountCents -= amountCents;
    creditor.amountCents -= amountCents;
    if (debtor.amountCents <= 0) debtorIndex += 1;
    if (creditor.amountCents <= 0) creditorIndex += 1;
  }
  return transfers;
}

function isFinishedEvent(start: Date | null, durationMinutes: number | null | undefined): boolean {
  if (!start || Number.isNaN(start.getTime())) return false;
  const duration = Number.isFinite(durationMinutes as number) ? Number(durationMinutes) : 120;
  const end = start.getTime() + Math.max(15, duration) * 60_000;
  return Date.now() > end;
}

async function computeSettlementInput(
  eventId: number,
  options?: {
    requireFinished?: boolean;
    scopeType?: SettlementScopeType;
    selectedParticipantIds?: number[] | null;
  },
) {
  const [bbq] = await db.select().from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!bbq) return null;
  const requireFinished = options?.requireFinished ?? false;
  if (requireFinished && !isFinishedEvent(bbq.date ?? null, bbq.durationMinutes)) return null;

  const [participants, allExpenses, shares] = await Promise.all([
    participantRepo.listByBbq(eventId, "accepted"),
    expenseRepo.listByBbq(eventId),
    bbq.allowOptInExpenses ? expenseRepo.getExpenseShares(eventId) : Promise.resolve([]),
  ]);
  const expenses = allExpenses.filter((expense) => isIncludedInFinalSettlement(expense));
  if (expenses.length === 0 || participants.length === 0) return null;

  const participantIdToUserId = new Map<number, number>();
  for (const participant of participants) {
    if (participant.userId != null) participantIdToUserId.set(participant.id, participant.userId);
  }

  const hasUnmappedExpensePayer = expenses.some((expense) => !participantIdToUserId.has(expense.participantId));
  if (hasUnmappedExpensePayer) return null;

  const settlementParticipants = participants
    .filter((participant) => participant.userId != null)
    .map((participant) => ({
      id: participant.userId as number,
      name: participant.name,
      participantId: participant.id,
    }));
  if (settlementParticipants.length === 0) return null;

  const scopeType = options?.scopeType === "selected" ? "selected" : "everyone";
  const selectedParticipantIdSet = scopeType === "selected"
    ? new Set(
      (options?.selectedParticipantIds ?? [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    )
    : null;
  if (scopeType === "selected" && (!selectedParticipantIdSet || selectedParticipantIdSet.size < 2)) {
    return null;
  }

  const effectiveShares = buildEffectiveExpenseShares({
    participants,
    expenses,
    legacyShares: shares,
    allowOptInExpenses: !!bbq.allowOptInExpenses,
  });
  const shouldUseCustomSplit = !!bbq.allowOptInExpenses || expenses.some((expense) => Array.isArray(expense.includedUserIds));

  let splitExpenses = expenses.map((expense) => ({
    id: expense.id,
    participantId: participantIdToUserId.get(expense.participantId) as number,
    amount: Number(expense.amount),
    originalParticipantId: expense.participantId,
  }));
  let splitShares = effectiveShares
    .map((share) => {
      const userId = participantIdToUserId.get(share.participantId);
      return userId == null ? null : {
        expenseId: share.expenseId,
        participantId: userId,
        originalParticipantId: share.participantId,
      };
    })
    .filter((share): share is { expenseId: number; participantId: number; originalParticipantId: number } => share != null);

  let scopedParticipants = settlementParticipants;
  if (scopeType === "selected" && selectedParticipantIdSet) {
    scopedParticipants = settlementParticipants.filter((participant) => selectedParticipantIdSet.has(participant.participantId));

    const selectedPayerExpenseIds = new Set(
      splitExpenses
        .filter((expense) => selectedParticipantIdSet.has(expense.originalParticipantId))
        .map((expense) => expense.id),
    );
    const totalShareCounts = new Map<number, number>();
    const selectedShareCounts = new Map<number, number>();
    for (const share of splitShares) {
      totalShareCounts.set(share.expenseId, (totalShareCounts.get(share.expenseId) ?? 0) + 1);
      if (selectedParticipantIdSet.has(share.originalParticipantId)) {
        selectedShareCounts.set(share.expenseId, (selectedShareCounts.get(share.expenseId) ?? 0) + 1);
      }
    }

    splitExpenses = splitExpenses
      .filter((expense) => selectedPayerExpenseIds.has(expense.id))
      .map((expense) => {
        const totalShares = totalShareCounts.get(expense.id) ?? 0;
        const selectedShares = selectedShareCounts.get(expense.id) ?? 0;
        const scopedAmount = totalShares > 0 ? Number(expense.amount) * (selectedShares / totalShares) : Number(expense.amount);
        return {
          ...expense,
          amount: Number(scopedAmount.toFixed(2)),
        };
      })
      .filter((expense) => expense.amount > 0.009);

    splitShares = splitShares.filter((share) => (
      selectedPayerExpenseIds.has(share.expenseId) && selectedParticipantIdSet.has(share.originalParticipantId)
    ));
  }

  const split = computeSplit(
    scopedParticipants.map((participant) => ({ id: participant.id, name: participant.name })),
    splitExpenses.map((expense) => ({ id: expense.id, participantId: expense.participantId, amount: expense.amount })),
    splitShares.map((share) => ({ expenseId: share.expenseId, participantId: share.participantId })),
    shouldUseCustomSplit,
  );
  const balances = split.balances.map((entry) => ({
    userId: entry.id,
    name: entry.name,
    balance: entry.balance,
  }));
  const transfers = computeSettlementTransfers(balances);
  if (transfers.length === 0) return null;

  const transferUserIds = Array.from(new Set(transfers.flatMap((transfer) => [transfer.fromUserId, transfer.toUserId])));
  if (transferUserIds.length > 0) {
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, transferUserIds));
    const existingUserSet = new Set(existingUsers.map((user) => user.id));
    if (transferUserIds.some((userId) => !existingUserSet.has(userId))) return null;
  }

  return {
    bbq,
    transfers,
    scopeType,
    selectedParticipantIds: scopeType === "selected" && selectedParticipantIdSet ? Array.from(selectedParticipantIdSet) : null,
  };
}

async function getRoundTitle(eventId: number) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(eventSettlementRounds)
    .where(and(
      eq(eventSettlementRounds.eventId, eventId),
      eq(eventSettlementRounds.roundType, "balance_settlement"),
    ));
  const next = Number(row?.count ?? 0) + 1;
  return `Final settlement ${next}`;
}

async function listTransfersForRound(roundId: string) {
  return db
    .select()
    .from(eventSettlementTransfers)
    .where(eq(eventSettlementTransfers.settlementRoundId, roundId))
    .orderBy(desc(eventSettlementTransfers.amountCents), asc(eventSettlementTransfers.createdAt));
}

async function resolveUserNames(transfers: Array<{ fromUserId: number; toUserId: number }>) {
  const userIds = Array.from(new Set(transfers.flatMap((transfer) => [transfer.fromUserId, transfer.toUserId])));
  if (userIds.length === 0) return new Map<number, string>();
  const userRows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(inArray(users.id, userIds));
  return new Map<number, string>(userRows.map((user) => [user.id, user.displayName || user.username]));
}

async function resolveUserDisplayNames(userIds: number[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((value) => Number.isFinite(value))));
  if (uniqueUserIds.length === 0) return new Map<number, string>();
  const userRows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      username: users.username,
    })
    .from(users)
    .where(inArray(users.id, uniqueUserIds));
  return new Map<number, string>(userRows.map((user) => [user.id, user.displayName || user.username]));
}

function buildSummary(
  round: {
    id: string;
    eventId: number;
    title: string;
    roundType: string;
    scopeType: string;
    selectedParticipantIds: number[] | null;
    status: string;
    createdByUserId: number | null;
    paidByUserId: number | null;
    createdAt: Date | null;
    completedAt: Date | null;
  },
  transfers: Array<{ amountCents: number; currency: string; paidAt: Date | null }>,
  paidByName: string | null,
): SettlementRoundSummary {
  const paidTransfersCount = transfers.filter((transfer) => !!transfer.paidAt).length;
  const totalAmountCents = transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0);
  const outstandingAmountCents = transfers.reduce((sum, transfer) => sum + (transfer.paidAt ? 0 : transfer.amountCents), 0);
  return {
    id: round.id,
    eventId: round.eventId,
    title: round.title,
    roundType: round.roundType as SettlementRoundType,
    scopeType: round.scopeType as SettlementScopeType,
    selectedParticipantIds: Array.isArray(round.selectedParticipantIds) ? round.selectedParticipantIds : null,
    status: round.status as SettlementRoundStatus,
    currency: transfers[0]?.currency ?? null,
    createdByUserId: round.createdByUserId ?? null,
    paidByUserId: round.paidByUserId ?? null,
    paidByName,
    createdAt: round.createdAt ? round.createdAt.toISOString() : null,
    completedAt: round.completedAt ? round.completedAt.toISOString() : null,
    transferCount: transfers.length,
    paidTransfersCount,
    totalAmount: fromCents(totalAmountCents),
    outstandingAmount: fromCents(outstandingAmountCents),
  };
}

export async function getActiveSettlement(
  eventId: number,
  roundType?: SettlementRoundType,
): Promise<SettlementRoundDetail | null> {
  const [round] = await db
    .select()
    .from(eventSettlementRounds)
    .where(and(
      eq(eventSettlementRounds.eventId, eventId),
      eq(eventSettlementRounds.status, "active"),
      ...(roundType ? [eq(eventSettlementRounds.roundType, roundType)] : []),
    ))
    .orderBy(desc(eventSettlementRounds.createdAt))
    .limit(1);
  if (!round) return null;
  return getSettlementById(eventId, round.id);
}

export async function getLatestSettlement(eventId: number) {
  const activeFinal = await getActiveSettlement(eventId, "balance_settlement");
  if (activeFinal) return activeFinal;
  const [latestFinal] = await db
    .select()
    .from(eventSettlementRounds)
    .where(and(
      eq(eventSettlementRounds.eventId, eventId),
      eq(eventSettlementRounds.roundType, "balance_settlement"),
    ))
    .orderBy(desc(eventSettlementRounds.createdAt))
    .limit(1);
  return latestFinal ? getSettlementById(eventId, latestFinal.id) : null;
}

export async function listSettlementRounds(eventId: number): Promise<SettlementRoundsList> {
  const rounds = await db
    .select()
    .from(eventSettlementRounds)
    .where(eq(eventSettlementRounds.eventId, eventId))
    .orderBy(desc(eventSettlementRounds.createdAt));
  if (rounds.length === 0) {
    return {
      activeFinalSettlementRound: null,
      activeQuickSettleRound: null,
      pastFinalSettlementRounds: [],
      pastQuickSettleRounds: [],
    };
  }

  const roundIds = rounds.map((round) => round.id);
  const transferRows = await db
    .select()
    .from(eventSettlementTransfers)
    .where(inArray(eventSettlementTransfers.settlementRoundId, roundIds));
  const payerNameById = await resolveUserDisplayNames(
    rounds.map((round) => round.paidByUserId).filter((value): value is number => value != null),
  );
  const transfersByRound = new Map<string, typeof transferRows>();
  for (const transfer of transferRows) {
    const list = transfersByRound.get(transfer.settlementRoundId) ?? [];
    list.push(transfer);
    transfersByRound.set(transfer.settlementRoundId, list);
  }

  const summaries = rounds.map((round) => buildSummary(
    round,
    transfersByRound.get(round.id) ?? [],
    round.paidByUserId != null ? payerNameById.get(round.paidByUserId) ?? null : null,
  ));
  const activeFinalSettlementRound = summaries.find((round) => round.status === "active" && round.roundType === "balance_settlement") ?? null;
  const activeQuickSettleRound = summaries.find((round) => round.status === "active" && round.roundType === "direct_split") ?? null;
  return {
    activeFinalSettlementRound,
    activeQuickSettleRound,
    pastFinalSettlementRounds: summaries.filter((round) => round.status !== "active" && round.roundType === "balance_settlement"),
    pastQuickSettleRounds: summaries.filter((round) => round.status !== "active" && round.roundType === "direct_split"),
  };
}

export async function getSettlementById(eventId: number, settlementId: string): Promise<SettlementRoundDetail | null> {
  const [round] = await db
    .select()
    .from(eventSettlementRounds)
    .where(and(
      eq(eventSettlementRounds.eventId, eventId),
      eq(eventSettlementRounds.id, settlementId),
    ))
    .limit(1);
  if (!round) return null;

  const transfers = await listTransfersForRound(round.id);
  const userNameById = await resolveUserNames(transfers);
  const paidByName = round.paidByUserId != null
    ? (await resolveUserDisplayNames([round.paidByUserId])).get(round.paidByUserId) ?? null
    : null;
  const summary = buildSummary(round, transfers, paidByName);

  return {
    settlement: {
      id: round.id,
      eventId: round.eventId,
      title: round.title,
      roundType: round.roundType as SettlementRoundType,
      scopeType: round.scopeType as SettlementScopeType,
      selectedParticipantIds: Array.isArray(round.selectedParticipantIds) ? round.selectedParticipantIds : null,
      status: round.status as SettlementRoundStatus,
      currency: summary.currency,
      createdByUserId: round.createdByUserId ?? null,
      paidByUserId: round.paidByUserId ?? null,
      paidByName,
      createdAt: round.createdAt ? round.createdAt.toISOString() : null,
      completedAt: round.completedAt ? round.completedAt.toISOString() : null,
    },
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      settlementId: transfer.settlementRoundId,
      settlementRoundId: transfer.settlementRoundId,
      fromUserId: transfer.fromUserId,
      fromName: userNameById.get(transfer.fromUserId) ?? `User ${transfer.fromUserId}`,
      toUserId: transfer.toUserId,
      toName: userNameById.get(transfer.toUserId) ?? `User ${transfer.toUserId}`,
      amountCents: transfer.amountCents,
      amount: fromCents(transfer.amountCents),
      currency: transfer.currency,
      paidAt: transfer.paidAt ? transfer.paidAt.toISOString() : null,
      paidByUserId: transfer.paidByUserId ?? null,
      paymentRef: transfer.paymentRef ?? null,
    })),
    summary: {
      transferCount: summary.transferCount,
      paidTransfersCount: summary.paidTransfersCount,
      totalAmount: summary.totalAmount,
      outstandingAmount: summary.outstandingAmount,
    },
  };
}

export async function createSettlementRound(input: {
  eventId: number;
  createdByUserId: number;
  actorName?: string | null;
  requireFinished?: boolean;
  scopeType?: SettlementScopeType;
  selectedParticipantIds?: number[] | null;
}) {
  const activeRound = await getActiveSettlement(input.eventId, "balance_settlement");
  if (activeRound?.settlement) {
    return { code: "active_settlement_exists" as const, detail: activeRound };
  }

  const settlementInput = await computeSettlementInput(input.eventId, {
    requireFinished: input.requireFinished ?? false,
    scopeType: input.scopeType,
    selectedParticipantIds: input.selectedParticipantIds,
  });
  if (!settlementInput) {
    return { code: "nothing_to_settle" as const, detail: null };
  }

  const title = await getRoundTitle(input.eventId);
  const [createdRound] = await db
    .insert(eventSettlementRounds)
    .values({
      eventId: input.eventId,
      title,
      roundType: "balance_settlement",
      scopeType: settlementInput.scopeType,
      selectedParticipantIds: settlementInput.selectedParticipantIds,
      status: "active",
      createdByUserId: input.createdByUserId,
      createdAt: new Date(),
    })
    .returning();
  if (!createdRound) {
    return { code: "create_failed" as const, detail: null };
  }

  await db.insert(eventSettlementTransfers).values(
    settlementInput.transfers.map((transfer) => ({
      settlementRoundId: createdRound.id,
      fromUserId: transfer.fromUserId,
      toUserId: transfer.toUserId,
      amountCents: transfer.amountCents,
      currency: settlementInput.bbq.currency,
    })),
  );

  const detail = await getSettlementById(input.eventId, createdRound.id);
  const actorName = input.actorName?.trim() || "Someone";
  await logPlanActivity({
    eventId: input.eventId,
    type: "SETTLEMENT_STARTED",
    actorUserId: input.createdByUserId,
    actorName,
    message: `${actorName} started the final settlement`,
      meta: {
        settlementRoundId: createdRound.id,
        title,
        roundType: "balance_settlement",
        scopeType: settlementInput.scopeType,
        selectedParticipantIds: settlementInput.selectedParticipantIds,
      },
    });
  await postSystemChatMessage(input.eventId, `${actorName} started the final settlement`, {
    type: "settlement",
    action: "started",
    settlementRoundId: createdRound.id,
    title,
    roundType: "balance_settlement",
    scopeType: settlementInput.scopeType,
    selectedParticipantIds: settlementInput.selectedParticipantIds,
    currency: settlementInput.bbq.currency,
  });
  broadcastEventRealtime(input.eventId, {
    type: "settlement:started",
    eventId: input.eventId,
    settlementRoundId: createdRound.id,
  });
  return { code: "created" as const, detail };
}

export async function createDirectSplitRound(input: {
  eventId: number;
  createdByUserId: number;
  actorName?: string | null;
  title: string;
  amount: number;
  paidByParticipantId: number;
  splitWithParticipantIds: number[];
}) {
  const activeRound = await getActiveSettlement(input.eventId, "direct_split");
  if (activeRound?.settlement) {
    return { code: "active_settlement_exists" as const, detail: activeRound };
  }

  const [bbq, participants] = await Promise.all([
    db.select().from(barbecues).where(eq(barbecues.id, input.eventId)).limit(1).then((rows) => rows[0] ?? null),
    participantRepo.listByBbq(input.eventId, "accepted"),
  ]);
  if (!bbq) return { code: "event_not_found" as const, detail: null };

  const title = input.title.trim();
  const amountCents = toCents(Number(input.amount));
  if (!title || amountCents <= 0) {
    return { code: "invalid_direct_split" as const, detail: null };
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const payerParticipant = participantById.get(input.paidByParticipantId);
  if (!payerParticipant?.userId) {
    return { code: "invalid_direct_split" as const, detail: null };
  }

  const selectedIds = Array.from(new Set(
    input.splitWithParticipantIds
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0 && value !== input.paidByParticipantId),
  ));
  const recipients = selectedIds
    .map((participantId) => participantById.get(participantId))
    .filter((participant): participant is NonNullable<typeof participant> => !!participant?.userId);
  if (recipients.length === 0) {
    return { code: "invalid_direct_split" as const, detail: null };
  }

  const amounts = splitAmountAcrossParticipants(amountCents, recipients.length);
  const transfers = recipients
    .map((participant, index) => ({
      settlementRoundId: "",
      fromUserId: participant.userId as number,
      toUserId: payerParticipant.userId as number,
      amountCents: amounts[index] ?? 0,
      currency: bbq.currency,
    }))
    .filter((transfer) => transfer.amountCents > 0);
  if (transfers.length === 0) {
    return { code: "invalid_direct_split" as const, detail: null };
  }

  const involvedParticipantIds = [payerParticipant.id, ...recipients.map((participant) => participant.id)];
  const [createdRound] = await db
    .insert(eventSettlementRounds)
    .values({
      eventId: input.eventId,
      title,
      roundType: "direct_split",
      scopeType: "selected",
      selectedParticipantIds: involvedParticipantIds,
      status: "active",
      createdByUserId: input.createdByUserId,
      paidByUserId: payerParticipant.userId,
      createdAt: new Date(),
    })
    .returning();
  if (!createdRound) {
    return { code: "create_failed" as const, detail: null };
  }

  await db.insert(eventSettlementTransfers).values(
    transfers.map((transfer) => ({
      ...transfer,
      settlementRoundId: createdRound.id,
    })),
  );

  const detail = await getSettlementById(input.eventId, createdRound.id);
  const actorName = input.actorName?.trim() || "Someone";
  const amount = fromCents(amountCents);
  await logPlanActivity({
    eventId: input.eventId,
    type: "SETTLEMENT_STARTED",
    actorUserId: input.createdByUserId,
    actorName,
    message: `${actorName} paid for ${title}`,
    meta: {
      settlementRoundId: createdRound.id,
      title,
      roundType: "direct_split",
      amount,
      currency: bbq.currency,
      paidByUserId: payerParticipant.userId,
      paidByName: payerParticipant.name,
      selectedParticipantIds: involvedParticipantIds,
    },
  });
  await postSystemChatMessage(input.eventId, `${actorName} paid for ${title}`, {
    type: "settlement",
    action: "started",
    settlementRoundId: createdRound.id,
    title,
    roundType: "direct_split",
    amount,
    currency: bbq.currency,
    paidByUserId: payerParticipant.userId,
    paidByName: payerParticipant.name,
    selectedParticipantIds: involvedParticipantIds,
  });
  broadcastEventRealtime(input.eventId, {
    type: "settlement:started",
    eventId: input.eventId,
    settlementRoundId: createdRound.id,
  });
  return { code: "created" as const, detail };
}

export async function ensureAutoSettlement(_eventId: number): Promise<void> {
  // Auto-creating settlements during passive reads makes round history harder to reason about.
}

export async function ensureSettlementForView(input: {
  eventId: number;
  createdByUserId: number;
  actorName?: string | null;
  requireFinished?: boolean;
  scopeType?: SettlementScopeType;
  selectedParticipantIds?: number[] | null;
}) {
  return createSettlementRound(input);
}

export async function markSettlementTransferPaid(input: {
  eventId: number;
  settlementId: string;
  transferId: string;
  paidByUserId: number;
}) {
  const txResult = await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(eventSettlementRounds)
      .where(and(
        eq(eventSettlementRounds.id, input.settlementId),
        eq(eventSettlementRounds.eventId, input.eventId),
      ))
      .limit(1);
    if (!round) return null;

    const [updatedTransfer] = await tx
      .update(eventSettlementTransfers)
      .set({ paidAt: new Date(), paidByUserId: input.paidByUserId })
      .where(and(
        eq(eventSettlementTransfers.id, input.transferId),
        eq(eventSettlementTransfers.settlementRoundId, input.settlementId),
        isNull(eventSettlementTransfers.paidAt),
      ))
      .returning();

    let transfer = updatedTransfer;
    let paymentStateChanged = true;
    if (!transfer) {
      const [existingTransfer] = await tx
        .select()
        .from(eventSettlementTransfers)
        .where(and(
          eq(eventSettlementTransfers.id, input.transferId),
          eq(eventSettlementTransfers.settlementRoundId, input.settlementId),
        ))
        .limit(1);
      if (!existingTransfer) return null;
      transfer = existingTransfer;
      paymentStateChanged = false;
    }

    const [remaining] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(eventSettlementTransfers)
      .where(and(
        eq(eventSettlementTransfers.settlementRoundId, input.settlementId),
        isNull(eventSettlementTransfers.paidAt),
      ));

    let completedTransitioned = false;
    if (Number(remaining?.count ?? 0) === 0) {
      const [transitioned] = await tx
        .update(eventSettlementRounds)
        .set({ status: "completed", completedAt: new Date() })
        .where(and(
          eq(eventSettlementRounds.id, input.settlementId),
          eq(eventSettlementRounds.eventId, input.eventId),
          eq(eventSettlementRounds.status, "active"),
        ))
        .returning({ id: eventSettlementRounds.id });
      completedTransitioned = !!transitioned;

      if (completedTransitioned && round.roundType === "balance_settlement") {
        await tx
          .update(barbecues)
          .set({ status: "settled", settledAt: new Date(), updatedAt: new Date() })
          .where(eq(barbecues.id, input.eventId));
      } else if (completedTransitioned && round.roundType === "direct_split") {
        await tx
          .update(expenses)
          .set({ settledAt: new Date() })
          .where(eq(expenses.linkedSettlementRoundId, input.settlementId));
      }
    }

    return {
      transfer,
      paymentStateChanged,
      completedTransitioned,
    };
  });

  if (!txResult) return null;

  if (txResult.paymentStateChanged) {
    const settlementSnapshot = await getSettlementById(input.eventId, input.settlementId);
    const transferSnapshot = settlementSnapshot?.transfers.find((row) => row.id === txResult.transfer.id) ?? null;
    const isDirectSplit = settlementSnapshot?.settlement?.roundType === "direct_split";
    await logPlanActivity({
      eventId: input.eventId,
      type: "SETTLEMENT_PAYMENT_PAID",
      actorUserId: input.paidByUserId,
      actorName: transferSnapshot?.fromUserId === input.paidByUserId
        ? transferSnapshot.fromName
        : transferSnapshot?.toName ?? null,
      message: transferSnapshot
        ? isDirectSplit
          ? `${transferSnapshot.fromName} paid ${transferSnapshot.toName}`
          : `${transferSnapshot.fromName} marked payment to ${transferSnapshot.toName} as paid`
        : "A settlement payment was marked as paid",
      meta: {
        settlementRoundId: input.settlementId,
        transferId: txResult.transfer.id,
        roundType: settlementSnapshot?.settlement?.roundType ?? "balance_settlement",
        title: settlementSnapshot?.settlement?.title ?? null,
        amount: fromCents(txResult.transfer.amountCents),
        currency: txResult.transfer.currency,
      },
    });
    await postSystemChatMessage(input.eventId, "Settlement payment marked as paid", {
      type: "settlement_payment",
      settlementRoundId: input.settlementId,
      transferId: txResult.transfer.id,
      fromUserId: txResult.transfer.fromUserId,
      toUserId: txResult.transfer.toUserId,
      amount: fromCents(txResult.transfer.amountCents),
      currency: txResult.transfer.currency,
      status: "paid",
    });
  }

  if (txResult.completedTransitioned) {
    const completedSnapshot = await getSettlementById(input.eventId, input.settlementId);
    const isDirectSplit = completedSnapshot?.settlement?.roundType === "direct_split";
    await logPlanActivity({
      eventId: input.eventId,
      type: "SETTLEMENT_COMPLETED",
      actorUserId: input.paidByUserId,
      message: isDirectSplit
        ? `${completedSnapshot?.settlement?.title || "Direct split"} completed`
        : `${completedSnapshot?.settlement?.title || "Final settlement"} completed`,
      meta: {
        settlementRoundId: input.settlementId,
        roundType: completedSnapshot?.settlement?.roundType ?? "balance_settlement",
        title: completedSnapshot?.settlement?.title ?? null,
        currency: txResult.transfer.currency,
      },
    });
    await postSystemChatMessage(input.eventId, isDirectSplit ? `✅ ${completedSnapshot?.settlement?.title || "Direct split"} completed` : `✅ ${completedSnapshot?.settlement?.title || "Final settlement"} completed`, {
      type: "settlement",
      action: "completed",
      settlementRoundId: input.settlementId,
      roundType: completedSnapshot?.settlement?.roundType ?? "balance_settlement",
      title: completedSnapshot?.settlement?.title ?? null,
      currency: txResult.transfer.currency,
    }, {
      clientMessageId: input.settlementId,
    });
    broadcastEventRealtime(input.eventId, {
      type: "settlement:completed",
      eventId: input.eventId,
      settlementRoundId: input.settlementId,
    });
  }

  return txResult.transfer;
}
