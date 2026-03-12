import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { expenses } from "@shared/schema";
import { db } from "../db";
import { log } from "./logger";
import { markSettlementTransferPaid } from "./settlement";

const stripeSettlementPaymentMetadataSchema = z.object({
  action: z.string().optional(),
  intendedAction: z.string().optional(),
  eventId: z.string().trim().min(1),
  settlementId: z.string().trim().min(1),
  transferId: z.string().trim().min(1),
  expenseId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  payerUserId: z.string().trim().min(1).optional(),
  payeeUserId: z.string().trim().min(1).optional(),
});

export async function reconcileStripeSettlementCheckout(input: {
  metadata?: Record<string, string | undefined>;
  paymentStatus?: string | null;
}) {
  log("info", "Stripe settlement reconciliation attempt", {
    paymentStatus: input.paymentStatus ?? null,
    metadata: input.metadata ?? null,
  });
  if (input.paymentStatus !== "paid") {
    log("info", "Stripe settlement reconciliation skipped: payment not paid", {
      paymentStatus: input.paymentStatus ?? null,
    });
    return { reconciled: false, eventId: null as number | null };
  }

  const parsed = stripeSettlementPaymentMetadataSchema.safeParse(input.metadata ?? {});
  if (!parsed.success) {
    log("warn", "Stripe settlement reconciliation failed: invalid metadata", {
      issues: parsed.error.issues.map((issue) => issue.message),
      metadata: input.metadata ?? null,
    });
    return { reconciled: false, eventId: null as number | null };
  }

  const metadata = parsed.data;
  const action = metadata.action ?? metadata.intendedAction;
  if (action !== "pay_settlement_transfer") {
    log("info", "Stripe settlement reconciliation skipped: unrelated action", { action });
    return { reconciled: false, eventId: null as number | null };
  }

  const eventId = Number(metadata.eventId);
  const paidByUserId = Number(metadata.payerUserId ?? metadata.userId);
  const settlementId = metadata.settlementId.trim();
  const transferId = metadata.transferId.trim();
  if (!Number.isFinite(eventId) || !Number.isFinite(paidByUserId) || !settlementId || !transferId) {
    log("warn", "Stripe settlement reconciliation failed: incomplete identifiers", {
      eventId: metadata.eventId,
      paidByUserId: metadata.payerUserId ?? metadata.userId,
      settlementId,
      transferId,
    });
    return { reconciled: false, eventId: null as number | null };
  }

  if (metadata.expenseId) {
    const expenseId = Number(metadata.expenseId);
    if (!Number.isFinite(expenseId)) {
      log("warn", "Stripe settlement reconciliation failed: invalid expense id", {
        expenseId: metadata.expenseId,
      });
      return { reconciled: false, eventId: null as number | null };
    }
    const [expense] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), eq(expenses.barbecueId, eventId)))
      .limit(1);
    if (!expense || expense.linkedSettlementRoundId !== settlementId) {
      log("warn", "Stripe settlement reconciliation failed: expense link mismatch", {
        eventId,
        expenseId,
        settlementId,
        linkedSettlementRoundId: expense?.linkedSettlementRoundId ?? null,
      });
      return { reconciled: false, eventId: null as number | null };
    }
  }

  await markSettlementTransferPaid({
    eventId,
    settlementId,
    transferId,
    paidByUserId,
  });
  log("info", "Stripe settlement reconciliation succeeded", {
    eventId,
    settlementId,
    transferId,
    paidByUserId,
  });

  return { reconciled: true, eventId };
}
