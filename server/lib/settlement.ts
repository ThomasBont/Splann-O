import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { computeSplit } from "@shared/lib/split/calc";
import { barbecues, eventSettlementTransfers, eventSettlements, users } from "@shared/schema";
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

function toCents(amount: number): number {
  return Math.round((Number.isFinite(amount) ? amount : 0) * 100);
}

function fromCents(cents: number): number {
  return Number((cents / 100).toFixed(2));
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

async function computeSettlementInput(eventId: number, options?: { requireFinished?: boolean }) {
  const [bbq] = await db.select().from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!bbq) return null;
  const requireFinished = options?.requireFinished ?? true;
  if (requireFinished && !isFinishedEvent(bbq.date ?? null, bbq.durationMinutes)) return null;

  const [participants, expenses, shares] = await Promise.all([
    participantRepo.listByBbq(eventId, "accepted"),
    expenseRepo.listByBbq(eventId),
    bbq.allowOptInExpenses ? expenseRepo.getExpenseShares(eventId) : Promise.resolve([]),
  ]);
  if (expenses.length === 0 || participants.length === 0) return null;

  const participantIdToUserId = new Map<number, number>();
  for (const participant of participants) {
    if (participant.userId != null) participantIdToUserId.set(participant.id, participant.userId);
  }

  // Settlements are persisted with user foreign keys.
  // If historical/guest participants without linked users are involved in expenses,
  // we currently cannot persist valid transfers safely.
  const hasUnmappedExpensePayer = expenses.some((expense) => !participantIdToUserId.has(expense.participantId));
  if (hasUnmappedExpensePayer) return null;

  const settlementParticipants = participants
    .filter((participant) => participant.userId != null)
    .map((participant) => ({
      id: participant.userId as number,
      name: participant.name,
    }));
  if (settlementParticipants.length === 0) return null;

  const effectiveShares = buildEffectiveExpenseShares({
    participants,
    expenses,
    legacyShares: shares,
    allowOptInExpenses: !!bbq.allowOptInExpenses,
  });
  const shouldUseCustomSplit = !!bbq.allowOptInExpenses || expenses.some((expense) => Array.isArray(expense.includedUserIds));

  const splitExpenses = expenses.map((expense) => ({
    id: expense.id,
    participantId: participantIdToUserId.get(expense.participantId) as number,
    amount: Number(expense.amount),
  }));
  const splitShares = effectiveShares
    .map((share) => {
      const userId = participantIdToUserId.get(share.participantId);
      return userId == null ? null : { expenseId: share.expenseId, participantId: userId };
    })
    .filter((share): share is { expenseId: number; participantId: number } => share != null);

  const split = computeSplit(
    settlementParticipants,
    splitExpenses,
    splitShares,
    shouldUseCustomSplit,
  );
  const balances = split.balances.map((entry) => ({
    userId: entry.id,
    name: entry.name,
    balance: entry.balance,
  }));
  const transfers = computeSettlementTransfers(balances);
  if (transfers.length === 0) return null;

  const transferUserIds = Array.from(new Set(
    transfers.flatMap((transfer) => [transfer.fromUserId, transfer.toUserId]),
  ));
  if (transferUserIds.length > 0) {
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, transferUserIds));
    const existingUserSet = new Set(existingUsers.map((user) => user.id));
    const hasUnknownUser = transferUserIds.some((userId) => !existingUserSet.has(userId));
    if (hasUnknownUser) return null;
  }

  return {
    bbq,
    transfers,
    idempotencyKey: `${eventId}:settlement:v1`,
  };
}

export async function ensureAutoSettlement(eventId: number): Promise<void> {
  const input = await computeSettlementInput(eventId, { requireFinished: true });
  if (!input) return;

  const [existing] = await db
    .select({ id: eventSettlements.id })
    .from(eventSettlements)
    .where(eq(eventSettlements.eventId, eventId))
    .orderBy(desc(eventSettlements.createdAt))
    .limit(1);
  if (existing) return;

  const inserted = await db.transaction(async (tx) => {
    const [createdSettlement] = await tx
      .insert(eventSettlements)
      .values({
        eventId,
        status: "proposed",
        source: "auto",
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: [eventSettlements.idempotencyKey] })
      .returning();
    if (!createdSettlement) return null;

    if (input.transfers.length > 0) {
      await tx.insert(eventSettlementTransfers).values(
        input.transfers.map((transfer) => ({
          settlementId: createdSettlement.id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          amountCents: transfer.amountCents,
          currency: input.bbq.currency,
        })),
      );
    }
    return createdSettlement;
  });

  if (!inserted) return;
  await logPlanActivity({
    eventId,
    type: "SETTLEMENT_STARTED",
    message: "Settlement started",
    meta: {
      settlementId: inserted.id,
      source: "auto",
    },
  });
  await postSystemChatMessage(eventId, "Settlement proposed", {
    type: "settlement",
    settlementId: inserted.id,
    action: "proposed",
    currency: input.bbq.currency,
  });
}

export async function ensureSettlementForView(eventId: number): Promise<void> {
  const [existing] = await db
    .select({ id: eventSettlements.id })
    .from(eventSettlements)
    .where(eq(eventSettlements.eventId, eventId))
    .orderBy(desc(eventSettlements.createdAt))
    .limit(1);
  if (existing) return;

  const input = await computeSettlementInput(eventId, { requireFinished: false });
  if (!input) return;

  const inserted = await db.transaction(async (tx) => {
    const [createdSettlement] = await tx
      .insert(eventSettlements)
      .values({
        eventId,
        status: "proposed",
        source: "manual",
        idempotencyKey: input.idempotencyKey,
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: [eventSettlements.idempotencyKey] })
      .returning();
    if (!createdSettlement) return null;

    if (input.transfers.length > 0) {
      await tx.insert(eventSettlementTransfers).values(
        input.transfers.map((transfer) => ({
          settlementId: createdSettlement.id,
          fromUserId: transfer.fromUserId,
          toUserId: transfer.toUserId,
          amountCents: transfer.amountCents,
          currency: input.bbq.currency,
        })),
      );
    }
    return createdSettlement;
  });

  if (!inserted) return;
  await logPlanActivity({
    eventId,
    type: "SETTLEMENT_STARTED",
    message: "Settlement started",
    meta: {
      settlementId: inserted.id,
      source: "manual",
    },
  });
  await postSystemChatMessage(eventId, "Settlement proposed", {
    type: "settlement",
    settlementId: inserted.id,
    action: "proposed",
    currency: input.bbq.currency,
  });
}

export async function getLatestSettlement(eventId: number) {
  const [settlement] = await db
    .select()
    .from(eventSettlements)
    .where(eq(eventSettlements.eventId, eventId))
    .orderBy(desc(eventSettlements.createdAt))
    .limit(1);
  if (!settlement) return null;
  return getSettlementById(eventId, settlement.id);
}

export async function getSettlementById(eventId: number, settlementId: string) {
  const [settlement] = await db
    .select()
    .from(eventSettlements)
    .where(and(
      eq(eventSettlements.eventId, eventId),
      eq(eventSettlements.id, settlementId),
    ))
    .limit(1);
  if (!settlement) return null;

  const transfers = await db
    .select()
    .from(eventSettlementTransfers)
    .where(eq(eventSettlementTransfers.settlementId, settlement.id));

  const userIds = Array.from(new Set(
    transfers.flatMap((transfer) => [transfer.fromUserId, transfer.toUserId]),
  ));
  const userRows = userIds.length > 0
    ? await db
      .select({
        id: users.id,
        displayName: users.displayName,
        username: users.username,
      })
      .from(users)
      .where(inArray(users.id, userIds))
    : [];
  const userNameById = new Map<number, string>(
    userRows.map((user) => [user.id, user.displayName || user.username]),
  );

  return {
    settlement: {
      id: settlement.id,
      eventId: settlement.eventId,
      status: settlement.status,
      source: settlement.source,
      currency: transfers[0]?.currency ?? null,
      createdAt: settlement.createdAt ? settlement.createdAt.toISOString() : null,
      settledAt: settlement.settledAt ? settlement.settledAt.toISOString() : null,
    },
    transfers: transfers.map((transfer) => ({
      id: transfer.id,
      settlementId: transfer.settlementId,
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
  };
}

export async function markSettlementTransferPaid(input: {
  eventId: number;
  settlementId: string;
  transferId: string;
  paidByUserId: number;
}) {
  const txResult = await db.transaction(async (tx) => {
    const [settlement] = await tx
      .select()
      .from(eventSettlements)
      .where(and(eq(eventSettlements.id, input.settlementId), eq(eventSettlements.eventId, input.eventId)))
      .limit(1);
    if (!settlement) return null;

    const [updatedTransfer] = await tx
      .update(eventSettlementTransfers)
      .set({ paidAt: new Date(), paidByUserId: input.paidByUserId })
      .where(and(
        eq(eventSettlementTransfers.id, input.transferId),
        eq(eventSettlementTransfers.settlementId, input.settlementId),
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
          eq(eventSettlementTransfers.settlementId, input.settlementId),
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
        eq(eventSettlementTransfers.settlementId, input.settlementId),
        isNull(eventSettlementTransfers.paidAt),
      ));

    const remainingCount = Number(remaining?.count ?? 0);
    let settledTransitioned = false;
    if (remainingCount === 0) {
      const [transitioned] = await tx
        .update(eventSettlements)
        .set({ status: "settled", settledAt: new Date() })
        .where(and(
          eq(eventSettlements.id, input.settlementId),
          eq(eventSettlements.eventId, input.eventId),
          isNull(eventSettlements.settledAt),
        ))
        .returning({ id: eventSettlements.id });
      settledTransitioned = !!transitioned;
    } else if (settlement.status === "proposed") {
      await tx
        .update(eventSettlements)
        .set({ status: "in_progress" })
        .where(and(
          eq(eventSettlements.id, input.settlementId),
          eq(eventSettlements.eventId, input.eventId),
          eq(eventSettlements.status, "proposed"),
        ));
    }

    return {
      transfer,
      paymentStateChanged,
      settledTransitioned,
    };
  });

  if (!txResult) return null;

  if (txResult.paymentStateChanged) {
    const settlementSnapshot = await getSettlementById(input.eventId, input.settlementId);
    const transferSnapshot = settlementSnapshot?.transfers.find((row) => row.id === txResult.transfer.id) ?? null;
    await logPlanActivity({
      eventId: input.eventId,
      type: "SETTLEMENT_PAYMENT_PAID",
      actorUserId: input.paidByUserId,
      actorName: transferSnapshot?.fromUserId === input.paidByUserId
        ? transferSnapshot.fromName
        : transferSnapshot?.toName ?? null,
      message: transferSnapshot
        ? `${transferSnapshot.fromName} marked payment to ${transferSnapshot.toName} as paid`
        : "A settlement payment was marked as paid",
      meta: {
        settlementId: input.settlementId,
        transferId: txResult.transfer.id,
        amount: fromCents(txResult.transfer.amountCents),
        currency: txResult.transfer.currency,
      },
    });
    await postSystemChatMessage(input.eventId, "Settlement payment marked as paid", {
      type: "settlement_payment",
      settlementId: input.settlementId,
      transferId: txResult.transfer.id,
      fromUserId: txResult.transfer.fromUserId,
      toUserId: txResult.transfer.toUserId,
      amount: fromCents(txResult.transfer.amountCents),
      currency: txResult.transfer.currency,
      status: "paid",
    });
  }

  if (txResult.settledTransitioned) {
    await logPlanActivity({
      eventId: input.eventId,
      type: "SETTLEMENT_COMPLETED",
      actorUserId: input.paidByUserId,
      message: "Settlement completed",
      meta: {
        settlementId: input.settlementId,
        currency: txResult.transfer.currency,
      },
    });
    await postSystemChatMessage(input.eventId, "✅ All settled up", {
      type: "settlement",
      settlementId: input.settlementId,
      action: "settled",
      currency: txResult.transfer.currency,
    }, {
      clientMessageId: input.settlementId,
    });
    broadcastEventRealtime(input.eventId, {
      type: "settlement:settled",
      eventId: input.eventId,
      settlementId: input.settlementId,
    });
  }

  return txResult.transfer;
}
