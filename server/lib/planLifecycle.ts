import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { barbecues, eventSettlementRounds, eventSettlementTransfers, type Barbecue } from "@shared/schema";
import { db, ensureCoreSchemaReady } from "../db";

export const PLAN_CLOSE_GRACE_PERIOD_MS = 2 * 24 * 60 * 60 * 1000;
export const PLAN_SETTLED_WRAP_UP_MS = 2 * 24 * 60 * 60 * 1000;
export const PLAN_CLOSED_CHAT_WRAP_UP_MS = 2 * 24 * 60 * 60 * 1000;

export type CanonicalPlanStatus = "active" | "closed" | "settled" | "archived";

type SettlementLockState = {
  hasActiveFinalSettlement: boolean;
  latestCompletedFinalSettlement: {
    id: string;
    completedAt: Date | null;
    latestPaidAt: Date | null;
  } | null;
};

export type PlanLifecycleState = {
  event: Barbecue;
  status: CanonicalPlanStatus;
  autoClosed: boolean;
  settlementStarted: boolean;
  timelineLocked: boolean;
  settledAt: Date | null;
  closeAt: Date | null;
  closedChatEndsAt: Date | null;
  wrapUpEndsAt: Date | null;
  socialOpen: boolean;
};

function normalizeStoredStatus(status: string | null | undefined): CanonicalPlanStatus {
  if (status === "archived") return "archived";
  if (status === "settled") return "settled";
  if (status === "closed") return "closed";
  return "active";
}

function resolvePlanEndDate(event: Pick<Barbecue, "endDate" | "date">): Date | string | null | undefined {
  return event.endDate ?? event.date ?? null;
}

export function getPlanCloseAt(eventDate: Date | string | null | undefined): Date | null {
  if (!eventDate) return null;
  const parsed = eventDate instanceof Date ? eventDate : new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + PLAN_CLOSE_GRACE_PERIOD_MS);
}

export function getClosedChatEndsAt(closeAt: Date | string | null | undefined): Date | null {
  if (!closeAt) return null;
  const parsed = closeAt instanceof Date ? closeAt : new Date(closeAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + PLAN_CLOSED_CHAT_WRAP_UP_MS);
}

function isPastCloseGracePeriod(event: Pick<Barbecue, "endDate" | "date">, now = new Date()): boolean {
  const closeAt = getPlanCloseAt(resolvePlanEndDate(event));
  if (!closeAt) return false;
  return now.getTime() > closeAt.getTime();
}

export function getPlanWrapUpEndsAt(settledAt: Date | string | null | undefined): Date | null {
  if (!settledAt) return null;
  const parsed = settledAt instanceof Date ? settledAt : new Date(settledAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + PLAN_SETTLED_WRAP_UP_MS);
}

async function getSettlementLockState(eventIds: number[]): Promise<Map<number, SettlementLockState>> {
  const uniqueIds = Array.from(new Set(eventIds.filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map<number, SettlementLockState>();
  if (uniqueIds.length === 0) return result;

  const rounds = await db
    .select()
    .from(eventSettlementRounds)
    .where(and(
      inArray(eventSettlementRounds.eventId, uniqueIds),
      eq(eventSettlementRounds.roundType, "balance_settlement"),
    ))
    .orderBy(desc(eventSettlementRounds.createdAt), asc(eventSettlementRounds.id));

  if (rounds.length === 0) return result;

  const roundIds = rounds.map((round) => round.id);
  const transfers = await db
    .select()
    .from(eventSettlementTransfers)
    .where(inArray(eventSettlementTransfers.settlementRoundId, roundIds));

  const transfersByRound = new Map<string, typeof transfers>();
  for (const transfer of transfers) {
    const current = transfersByRound.get(transfer.settlementRoundId) ?? [];
    current.push(transfer);
    transfersByRound.set(transfer.settlementRoundId, current);
  }

  for (const eventId of uniqueIds) {
    const eventRounds = rounds.filter((round) => round.eventId === eventId);
    const activeFinal = eventRounds.some((round) => round.status === "active");

    const completedRound = eventRounds.find((round) => {
      const roundTransfers = transfersByRound.get(round.id) ?? [];
      if (roundTransfers.length === 0) return false;
      return round.status === "completed" || roundTransfers.every((transfer) => !!transfer.paidAt);
    }) ?? null;

    let latestCompletedFinalSettlement: SettlementLockState["latestCompletedFinalSettlement"] = null;
    if (completedRound) {
      const roundTransfers = transfersByRound.get(completedRound.id) ?? [];
      const latestPaidAt = roundTransfers
        .map((transfer) => transfer.paidAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      latestCompletedFinalSettlement = {
        id: completedRound.id,
        completedAt: completedRound.completedAt ?? null,
        latestPaidAt,
      };
    }

    result.set(eventId, {
      hasActiveFinalSettlement: activeFinal,
      latestCompletedFinalSettlement,
    });
  }

  return result;
}

function deriveLifecycleState(
  event: Barbecue,
  settlementState?: SettlementLockState,
  now = new Date(),
): Omit<PlanLifecycleState, "event"> {
  const normalizedStatus = normalizeStoredStatus(event.status);
  const completedSettlement = settlementState?.latestCompletedFinalSettlement ?? null;
  const completedAt = completedSettlement?.completedAt ?? completedSettlement?.latestPaidAt ?? event.settledAt ?? null;
  const closeAt = getPlanCloseAt(resolvePlanEndDate(event));
  const closedChatEndsAt = getClosedChatEndsAt(closeAt);
  const wrapUpEndsAt = getPlanWrapUpEndsAt(completedAt);
  const archivedByTime = !!wrapUpEndsAt && now.getTime() > wrapUpEndsAt.getTime();

  if (completedSettlement || normalizedStatus === "settled" || normalizedStatus === "archived") {
    const status = archivedByTime || normalizedStatus === "archived" ? "archived" : "settled";
    return {
      status,
      autoClosed: false,
      settlementStarted: false,
      timelineLocked: true,
      settledAt: completedAt,
      closeAt,
      closedChatEndsAt,
      wrapUpEndsAt,
      socialOpen: status === "settled",
    };
  }

  const autoClosed = isPastCloseGracePeriod(event, now);
  const closedSocialOpen = autoClosed && !!closedChatEndsAt && now.getTime() <= closedChatEndsAt.getTime();
  return {
    status: autoClosed ? "closed" : "active",
    autoClosed,
    settlementStarted: settlementState?.hasActiveFinalSettlement ?? false,
    timelineLocked: autoClosed || (settlementState?.hasActiveFinalSettlement ?? false),
    settledAt: event.settledAt ?? null,
    closeAt,
    closedChatEndsAt,
    wrapUpEndsAt: null,
    socialOpen: autoClosed ? closedSocialOpen : true,
  };
}

export async function refreshPlanLifecycle(eventId: number, now = new Date()): Promise<PlanLifecycleState | null> {
  await ensureCoreSchemaReady();
  const [event] = await db.select().from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!event) return null;
  const settlementState = (await getSettlementLockState([eventId])).get(eventId);
  const derived = deriveLifecycleState(event, settlementState, now);

  const patch: Partial<Barbecue> = {};
  if (event.status !== derived.status) patch.status = derived.status;
  if (derived.status === "settled" && derived.settledAt && (!event.settledAt || event.settledAt.getTime() !== derived.settledAt.getTime())) {
    patch.settledAt = derived.settledAt;
  }
  if (derived.status !== "settled" && derived.status !== "archived" && event.settledAt && normalizeStoredStatus(event.status) !== "settled" && normalizeStoredStatus(event.status) !== "archived") {
    patch.settledAt = null;
  }

  const nextEvent = Object.keys(patch).length > 0
    ? ((await db.update(barbecues).set({ ...patch, updatedAt: new Date() }).where(eq(barbecues.id, eventId)).returning())[0] ?? event)
    : event;

  return {
    event: nextEvent,
    ...deriveLifecycleState(nextEvent, settlementState, now),
  };
}

export async function refreshPlanLifecycles(eventIds: number[], now = new Date()): Promise<Map<number, PlanLifecycleState>> {
  await ensureCoreSchemaReady();
  const uniqueIds = Array.from(new Set(eventIds.filter((id) => Number.isInteger(id) && id > 0)));
  const result = new Map<number, PlanLifecycleState>();
  if (uniqueIds.length === 0) return result;

  const events = await db.select().from(barbecues).where(inArray(barbecues.id, uniqueIds));
  if (events.length === 0) return result;
  const settlementStateByEventId = await getSettlementLockState(uniqueIds);

  for (const event of events) {
    const settlementState = settlementStateByEventId.get(event.id);
    const derived = deriveLifecycleState(event, settlementState, now);
    const patch: Partial<Barbecue> = {};
    if (event.status !== derived.status) patch.status = derived.status;
    if (derived.status === "settled" && derived.settledAt && (!event.settledAt || event.settledAt.getTime() !== derived.settledAt.getTime())) {
      patch.settledAt = derived.settledAt;
    }
    if (derived.status !== "settled" && derived.status !== "archived" && event.settledAt && normalizeStoredStatus(event.status) !== "settled" && normalizeStoredStatus(event.status) !== "archived") {
      patch.settledAt = null;
    }

    const nextEvent = Object.keys(patch).length > 0
      ? ((await db.update(barbecues).set({ ...patch, updatedAt: new Date() }).where(eq(barbecues.id, event.id)).returning())[0] ?? event)
      : event;

    result.set(event.id, {
      event: nextEvent,
      ...deriveLifecycleState(nextEvent, settlementState, now),
    });
  }

  return result;
}

export async function getPlanLifecycleState(eventId: number, now = new Date()): Promise<PlanLifecycleState | null> {
  return refreshPlanLifecycle(eventId, now);
}

export async function hasActiveFinalSettlement(eventId: number): Promise<boolean> {
  const settlementState = (await getSettlementLockState([eventId])).get(eventId);
  return settlementState?.hasActiveFinalSettlement ?? false;
}
