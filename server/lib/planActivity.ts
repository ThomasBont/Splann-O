import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { planActivity } from "@shared/schema";
import { broadcastEventRealtime } from "./eventRealtime";

export type PlanActivityType = "PLAN_UPDATED" | "EXPENSE_ADDED" | "EXPENSE_DELETED" | "MEMBER_JOINED";

type LogPlanActivityInput = {
  eventId: number;
  type: PlanActivityType;
  actorUserId?: number | null;
  actorName?: string | null;
  message: string;
  meta?: Record<string, unknown> | null;
};

export async function logPlanActivity(input: LogPlanActivityInput) {
  const [created] = await db.insert(planActivity).values({
    eventId: input.eventId,
    type: input.type,
    actorUserId: input.actorUserId ?? null,
    actorName: input.actorName ?? null,
    message: input.message,
    meta: input.meta ?? null,
    createdAt: new Date(),
  }).returning();

  if (!created) return null;
  const payload = {
    id: created.id,
    eventId: created.eventId,
    type: created.type,
    actorUserId: created.actorUserId ?? null,
    actorName: created.actorName ?? null,
    message: created.message,
    meta: created.meta ?? null,
    createdAt: created.createdAt ? created.createdAt.toISOString() : new Date().toISOString(),
  };

  broadcastEventRealtime(input.eventId, {
    type: "PLAN_ACTIVITY_CREATED",
    eventId: input.eventId,
    activity: payload,
  });

  return payload;
}

export async function listPlanActivity(eventId: number, limit = 10) {
  const safeLimit = Math.max(1, Math.min(50, Number.isFinite(limit) ? Math.trunc(limit) : 10));
  const rows = await db.select().from(planActivity)
    .where(eq(planActivity.eventId, eventId))
    .orderBy(desc(planActivity.createdAt))
    .limit(safeLimit);

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    type: row.type,
    actorUserId: row.actorUserId ?? null,
    actorName: row.actorName ?? null,
    message: row.message,
    meta: row.meta ?? null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  }));
}
