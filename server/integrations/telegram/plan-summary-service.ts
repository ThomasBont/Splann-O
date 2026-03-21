import { eq } from "drizzle-orm";
import { barbecues } from "@shared/schema";
import { db } from "../../db";
import { participantRepo } from "../../repositories/participantRepo";
import { expenseRepo } from "../../repositories/expenseRepo";
import { listSettlementRounds } from "../../lib/settlement";
import { getLinkedPlanForTelegramChat } from "./plan-link-service";

type LinkedTelegramPlan = NonNullable<Awaited<ReturnType<typeof getLinkedPlanForTelegramChat>>>;

type PlanSnapshot = {
  planId: number;
  planName: string;
  currency: string;
  date: Date | null;
  joined: Array<{ id: number; name: string }>;
  pending: Array<{ id: number; name: string }>;
  invited: Array<{ id: number; name: string }>;
  totalSpent: number;
  topSpenders: Array<{ name: string; amount: number }>;
  expenseCount: number;
  settlement: Awaited<ReturnType<typeof listSettlementRounds>>;
};

export type TelegramPlanStatus = {
  planId: number;
  planName: string;
  currency: string;
  joinedCount: number;
  outstandingCount: number;
  totalSpent: number;
};

export type TelegramNextStep = {
  planId: number;
  planName: string;
  title: string;
  detail: string;
  ctaLabel: string;
};

export type TelegramParticipantsSummary = {
  planId: number;
  planName: string;
  joined: string[];
  pending: string[];
};

export type TelegramExpensesSummary = {
  planId: number;
  planName: string;
  currency: string;
  totalSpent: number;
  expenseCount: number;
  topSpenders: Array<{ name: string; amount: number }>;
};

export type TelegramSettlementStatus = {
  planId: number;
  planName: string;
  state: "not_ready" | "ready" | "in_progress" | "completed";
  title: string;
  detail: string;
  currency: string;
};

async function getPlanSnapshot(planId: number): Promise<PlanSnapshot> {
  const safePlanId = Number(planId);
  if (!Number.isInteger(safePlanId) || safePlanId <= 0) {
    throw new Error("Plan id must be a positive integer");
  }

  const [plan] = await db
    .select({
      id: barbecues.id,
      name: barbecues.name,
      currency: barbecues.currency,
      date: barbecues.date,
    })
    .from(barbecues)
    .where(eq(barbecues.id, safePlanId))
    .limit(1);

  if (!plan) {
    throw new Error("Plan not found");
  }

  const [joined, pending, invited, allExpenses, settlement] = await Promise.all([
    participantRepo.listByBbq(safePlanId, "accepted"),
    participantRepo.listByBbq(safePlanId, "pending"),
    participantRepo.listByBbq(safePlanId, "invited"),
    expenseRepo.listByBbq(safePlanId),
    listSettlementRounds(safePlanId),
  ]);

  const totalSpent = allExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
  const spendByName = new Map<string, number>();
  for (const expense of allExpenses) {
    const name = String(expense.participantName ?? "Unknown").trim() || "Unknown";
    const amount = Number(expense.amount ?? 0);
    spendByName.set(name, (spendByName.get(name) ?? 0) + (Number.isFinite(amount) ? amount : 0));
  }

  const topSpenders = Array.from(spendByName.entries())
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name))
    .slice(0, 3);

  return {
    planId: plan.id,
    planName: plan.name,
    currency: String(plan.currency ?? "EUR").trim().toUpperCase() || "EUR",
    date: plan.date ?? null,
    joined: joined.map((participant) => ({ id: participant.id, name: participant.name })),
    pending: pending.map((participant) => ({ id: participant.id, name: participant.name })),
    invited: invited.map((participant) => ({ id: participant.id, name: participant.name })),
    totalSpent: Number(totalSpent.toFixed(2)),
    topSpenders,
    expenseCount: allExpenses.length,
    settlement,
  };
}

export async function resolveTelegramPlanFromChat(chatId: number | string): Promise<LinkedTelegramPlan | null> {
  return getLinkedPlanForTelegramChat(chatId);
}

export async function getPlanStatus(planId: number): Promise<TelegramPlanStatus> {
  const snapshot = await getPlanSnapshot(planId);
  return {
    planId: snapshot.planId,
    planName: snapshot.planName,
    currency: snapshot.currency,
    joinedCount: snapshot.joined.length,
    outstandingCount: snapshot.pending.length + snapshot.invited.length,
    totalSpent: snapshot.totalSpent,
  };
}

export async function getNextStep(planId: number): Promise<TelegramNextStep> {
  const snapshot = await getPlanSnapshot(planId);
  const outstandingCount = snapshot.pending.length + snapshot.invited.length;

  if (snapshot.settlement.activeFinalSettlementRound) {
    const round = snapshot.settlement.activeFinalSettlementRound;
    const remainingTransfers = Math.max(0, round.transferCount - round.paidTransfersCount);
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      title: "finish settlement",
      detail: remainingTransfers > 0
        ? `${remainingTransfers} payment${remainingTransfers === 1 ? "" : "s"} still need to be marked as paid`
        : "Review the settlement and make sure everyone confirms their payment",
      ctaLabel: "Settle up",
    };
  }

  if (outstandingCount > 0) {
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      title: "get everyone to join",
      detail: `${outstandingCount} ${outstandingCount === 1 ? "person still needs" : "people still need"} to join`,
      ctaLabel: "Invite friends",
    };
  }

  if (snapshot.totalSpent <= 0) {
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      title: "add the first shared expense",
      detail: "No shared costs have been tracked yet",
      ctaLabel: "View expenses",
    };
  }

  return {
    planId: snapshot.planId,
    planName: snapshot.planName,
    title: "review shared costs",
    detail: snapshot.date && snapshot.date.getTime() < Date.now()
      ? "Everyone is in. This is a good moment to start settlement."
      : "Shared costs are active. Keep the totals up to date before the plan starts.",
    ctaLabel: snapshot.date && snapshot.date.getTime() < Date.now() ? "Settle up" : "View expenses",
  };
}

export async function getParticipants(planId: number): Promise<TelegramParticipantsSummary> {
  const snapshot = await getPlanSnapshot(planId);
  return {
    planId: snapshot.planId,
    planName: snapshot.planName,
    joined: snapshot.joined.map((participant) => participant.name),
    pending: [...snapshot.pending, ...snapshot.invited].map((participant) => participant.name),
  };
}

export async function getExpensesSummary(planId: number): Promise<TelegramExpensesSummary> {
  const snapshot = await getPlanSnapshot(planId);
  return {
    planId: snapshot.planId,
    planName: snapshot.planName,
    currency: snapshot.currency,
    totalSpent: snapshot.totalSpent,
    expenseCount: snapshot.expenseCount,
    topSpenders: snapshot.topSpenders,
  };
}

export async function getSettlementStatus(planId: number): Promise<TelegramSettlementStatus> {
  const snapshot = await getPlanSnapshot(planId);
  const outstandingCount = snapshot.pending.length + snapshot.invited.length;
  const activeFinal = snapshot.settlement.activeFinalSettlementRound;
  const completedFinal = snapshot.settlement.pastFinalSettlementRounds
    .slice()
    .sort((left, right) => {
      const leftTime = left.completedAt ? new Date(left.completedAt).getTime() : 0;
      const rightTime = right.completedAt ? new Date(right.completedAt).getTime() : 0;
      return rightTime - leftTime;
    })[0] ?? null;

  if (activeFinal) {
    const remainingTransfers = Math.max(0, activeFinal.transferCount - activeFinal.paidTransfersCount);
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      state: "in_progress",
      title: "Settlement in progress",
      detail: remainingTransfers > 0
        ? `${remainingTransfers} payment${remainingTransfers === 1 ? "" : "s"} still need attention`
        : "Settlement is active and waiting for final confirmation",
      currency: snapshot.currency,
    };
  }

  if (completedFinal) {
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      state: "completed",
      title: "Settlement completed",
      detail: "This plan already has a completed final settlement",
      currency: snapshot.currency,
    };
  }

  if (outstandingCount > 0) {
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      state: "not_ready",
      title: "Not ready",
      detail: `${outstandingCount} ${outstandingCount === 1 ? "person still needs" : "people still need"} to join`,
      currency: snapshot.currency,
    };
  }

  if (snapshot.totalSpent <= 0) {
    return {
      planId: snapshot.planId,
      planName: snapshot.planName,
      state: "not_ready",
      title: "Not ready",
      detail: "No shared expenses have been added yet",
      currency: snapshot.currency,
    };
  }

  return {
    planId: snapshot.planId,
    planName: snapshot.planName,
    state: "ready",
    title: "Ready to settle",
    detail: "Everyone is in and shared expenses are tracked",
    currency: snapshot.currency,
  };
}
