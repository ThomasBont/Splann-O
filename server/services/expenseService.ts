import { db } from "../db";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { bbqRepo } from "../repositories/bbqRepo";
import { planActivity, expenses } from "@shared/schema";
import { eq } from "drizzle-orm";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { getExpenseLockState } from "@shared/lib/expense-lock";
import { assertExpenseMutationsWritable } from "../routes/_helpers";
import * as bbqService from "./bbqService";

function normalizeIncludedUserIds(input: unknown): string[] | null | undefined {
  if (input === undefined) return undefined;
  if (input == null) return null;
  if (!Array.isArray(input)) return null;
  const cleaned = Array.from(
    new Set(
      input
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    ),
  );
  return cleaned;
}

function parseParticipantIdList(input: string[] | null | undefined) {
  if (input == null) return input;
  return input
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

export async function updateExpenseForPlan(params: {
  expenseId: number;
  userId: number;
  username?: string | null;
  updates: {
    item?: string;
    category?: string;
    amount?: number;
    participantId?: number;
    includedUserIds?: string[] | null;
    occurredOn?: string | null;
  };
}) {
  const { expenseId, userId, username, updates } = params;
  const [before] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!before) notFound("Expense not found");

  const bbq = await bbqRepo.getById(before.barbecueId);
  if (!bbq) notFound("Event not found");
  const accessible = await bbqService.getBarbecueIfAccessible(before.barbecueId, userId, username ?? undefined);
  if (!accessible) notFound("Expense not found");

  await assertExpenseMutationsWritable(before.barbecueId);
  const lockState = getExpenseLockState({
    planStatus: accessible.status,
    settlementStarted: accessible.settlementStarted,
    linkedSettlementRoundId: before.linkedSettlementRoundId,
    settledAt: before.settledAt,
    excludedFromFinalSettlement: before.excludedFromFinalSettlement,
    resolutionMode: before.resolutionMode,
  });
  if (lockState.locked) forbidden(lockState.message ?? "This expense is locked.");

  const isCreator = bbq.creatorUserId === userId;
  const acceptedParticipants = await participantRepo.listByBbq(before.barbecueId, "accepted");
  const acceptedParticipantIds = new Set(acceptedParticipants.map((participant) => participant.id));
  const nextParticipantId = updates.participantId !== undefined ? Number(updates.participantId) : Number(before.participantId);
  const payerParticipant = acceptedParticipants.find((participant) => participant.id === nextParticipantId);
  if (!payerParticipant) badRequest("Paid by must be a plan member");
  if (!isCreator && updates.participantId !== undefined && payerParticipant.userId !== userId) {
    forbidden("Only the plan creator can change who paid");
  }

  const includedUserIds = normalizeIncludedUserIds(updates.includedUserIds);
  const includedParticipantIds = parseParticipantIdList(includedUserIds);
  if (includedParticipantIds && includedParticipantIds.some((participantId) => !acceptedParticipantIds.has(participantId))) {
    badRequest("Split members must be accepted plan participants");
  }

  const txResult = await db.transaction(async (tx) => {
    const updated = await expenseRepo.update(expenseId, {
      ...updates,
      ...(includedUserIds !== undefined ? { includedUserIds } : {}),
    }, tx);
    if (!updated) return null;

    const beforeIncluded = normalizeIncludedUserIds(before.includedUserIds) ?? null;
    const afterIncluded = normalizeIncludedUserIds(updated.includedUserIds) ?? null;
    const splitChanged = JSON.stringify(beforeIncluded) !== JSON.stringify(afterIncluded);
    const changed = (
      (updates.item !== undefined && updates.item !== before.item)
      || (updates.category !== undefined && updates.category !== before.category)
      || (updates.amount !== undefined && Number(updates.amount) !== Number(before.amount))
      || (updates.participantId !== undefined && Number(updates.participantId) !== Number(before.participantId))
      || (updates.occurredOn !== undefined && (updates.occurredOn ?? null) !== (before.occurredOn ?? null))
      || splitChanged
    );

    let activityRow: typeof planActivity.$inferSelect | null = null;
    if (changed) {
      const actorName = username || "Someone";
      const currency = bbq.currency ?? "€";
      const amount = Number(updated.amount);
      const [insertedActivity] = await tx.insert(planActivity).values({
        eventId: updated.barbecueId,
        type: "EXPENSE_UPDATED",
        actorUserId: userId,
        actorName,
        message: `${actorName} edited an expense`,
        meta: {
          expenseId: updated.id,
          title: updated.item,
          amount: Number.isFinite(amount) ? amount : null,
          currency: bbq.currency ?? null,
          previousTitle: before.item,
          previousAmount: Number(before.amount),
        },
        createdAt: new Date(),
      }).returning();
      activityRow = insertedActivity ?? null;
    }

    return { updated, changed, activityRow, payerParticipant } as const;
  });

  if (!txResult?.updated) notFound("Expense not found");
  return txResult;
}

export async function deleteExpenseForPlan(params: {
  expenseId: number;
  userId: number;
  username: string;
}) {
  const { expenseId, userId, username } = params;
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense) notFound("Expense not found");

  const accessible = await bbqService.getBarbecueIfAccessible(expense.barbecueId, userId, username);
  if (!accessible) notFound("Expense not found");

  if (expense.createdByUserId == null || Number(expense.createdByUserId) !== Number(userId)) {
    forbidden("Only the person who created this expense can delete it.");
  }

  await assertExpenseMutationsWritable(expense.barbecueId);
  const lockState = getExpenseLockState({
    planStatus: accessible.status,
    settlementStarted: accessible.settlementStarted,
    linkedSettlementRoundId: expense.linkedSettlementRoundId,
    settledAt: expense.settledAt,
    excludedFromFinalSettlement: expense.excludedFromFinalSettlement,
    resolutionMode: expense.resolutionMode,
  });
  if (lockState.locked) forbidden(lockState.message ?? "This expense is locked.");

  const bbq = await bbqRepo.getById(expense.barbecueId);
  if (!bbq) notFound("Event not found");

  const actorName = username || "Someone";
  const expenseTitle = expense.item?.trim() || "Expense";
  const amount = Number(expense.amount);
  const paidByParticipant = expense.participantId
    ? await participantRepo.getById(Number(expense.participantId))
    : null;

  const txResult = await db.transaction(async (tx) => {
    await expenseRepo.delete(expenseId, tx);
    const [activityRow] = await tx.insert(planActivity).values({
      eventId: expense.barbecueId,
      type: "EXPENSE_DELETED",
      actorUserId: userId,
      actorName,
      message: `${actorName} deleted an expense`,
      meta: {
        expenseId,
        amount: Number.isFinite(amount) ? amount : null,
        currency: bbq.currency ?? null,
        title: expenseTitle,
      },
      createdAt: new Date(),
    }).returning();
    return {
      expense,
      activityRow: activityRow ?? null,
      expenseTitle,
      amount,
      paidByName: paidByParticipant?.name || actorName,
      currency: bbq.currency ?? "€",
    } as const;
  });

  return txResult;
}
