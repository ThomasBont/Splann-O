// Expense routes: expense CRUD, receipt upload/delete, and expense shares.
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { api } from "@shared/routes";
import { barbecues, expenses, planActivity } from "@shared/schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { db } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { broadcastPlanBalancesUpdated } from "../lib/planBalancesRealtime";
import { logPlanActivity } from "../lib/planActivity";
import { createDirectSplitRoundRecord } from "../lib/settlement";
import { postSystemChatMessage } from "../lib/systemChat";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import { log } from "../lib/logger";
import { receiptScanLimiter, receiptUploadLimiter } from "../middleware/rate-limit";
import { asyncHandler, assertEventAccessOrThrow, assertExpensesWritable, ensurePrivateEventParticipantOrCreator, getBarbecueOr404, p } from "./_helpers";
import { deleteFile, uploadFile } from "../lib/r2";
import { scanReceiptWithVision } from "../lib/vision-receipt";

const router = Router();
const RECEIPT_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/receipts");
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_RECEIPT_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

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

function parseReceiptDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid receipt image");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  if (!ALLOWED_RECEIPT_MIME.has(mime)) badRequest("Unsupported image type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid image payload");
  if (buffer.length > MAX_RECEIPT_SIZE_BYTES) badRequest("Receipt image must be 5MB or smaller");
  return { mime, buffer };
}

function broadcastPlanActivityCreated(
  eventId: number,
  activity: typeof planActivity.$inferSelect | null | undefined,
) {
  if (!activity) return;
  broadcastEventRealtime(eventId, {
    type: "PLAN_ACTIVITY_CREATED",
    eventId,
    activity: {
      id: activity.id,
      eventId: activity.eventId,
      type: activity.type,
      actorUserId: activity.actorUserId ?? null,
      actorName: activity.actorName ?? null,
      message: activity.message,
      meta: activity.meta ?? null,
      createdAt: activity.createdAt ? activity.createdAt.toISOString() : new Date().toISOString(),
    },
  });
}

function getReqId(req: Parameters<typeof asyncHandler>[0] extends (req: infer T, ...args: any[]) => any ? T : never) {
  return (req as typeof req & { requestId?: string }).requestId;
}

router.get(p(api.expenses.list.path), requireAuth, asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await expenseRepo.listByBbq(bbq.id);
  res.json(items);
}));

router.post(p(api.expenses.create.path), requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const bbq = await getBarbecueOr404(req, bbqId);
  await assertExpensesWritable(bbqId);
  const sessionUserId = req.session?.userId;
  if (!sessionUserId) unauthorized("Not authenticated");
  const bodySchema = api.expenses.create.input.extend({
    amount: z.coerce.number(),
    participantId: z.coerce.number(),
    includedUserIds: z.array(z.string()).optional().nullable(),
    resolutionMode: z.enum(["later", "now"]).optional(),
    occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    category: z.string().optional().default("other"),
  });
  const input = bodySchema.parse(req.body);
  const acceptedParticipants = await participantRepo.listByBbq(bbqId, "accepted");
  const acceptedParticipantIds = new Set(acceptedParticipants.map((participant) => participant.id));
  const creatorParticipant = acceptedParticipants.find((participant) => participant.userId === sessionUserId);
  if (!creatorParticipant) forbidden("Only accepted event participants can create expenses");
  const payerParticipant = acceptedParticipants.find((participant) => participant.id === input.participantId);
  if (!payerParticipant) badRequest("Paid by must be a plan member");
  const { optInByDefault, ...expenseData } = input;
  const includedUserIds = normalizeIncludedUserIds(expenseData.includedUserIds);
  const includedParticipantIds = parseParticipantIdList(includedUserIds);
  if (includedParticipantIds && includedParticipantIds.some((participantId) => !acceptedParticipantIds.has(participantId))) {
    badRequest("Split members must be accepted plan participants");
  }
  const resolutionMode = input.resolutionMode === "now" ? "now" : "later";
  const actorName = creatorParticipant.name || req.session?.username || "Someone";
  const paidByName = payerParticipant.name || req.session?.username || "Someone";
  const currency = bbq.currency ?? "€";
  const paidBySuffix = payerParticipant.userId !== sessionUserId ? `, paid by ${paidByName}` : "";
  const txResult = await db.transaction(async (tx) => {
    const created = await expenseRepo.create(
      {
        ...expenseData,
        barbecueId: bbqId,
        createdByUserId: sessionUserId,
        includedUserIds: includedUserIds === undefined ? null : includedUserIds,
        resolutionMode,
        excludedFromFinalSettlement: resolutionMode === "now",
        settledAt: null,
      },
      { optInByDefault, executor: tx },
    );
    const amount = Number(created.amount);
    let createdWithResolution = created;
    let directSplitResult:
      | Awaited<ReturnType<typeof createDirectSplitRoundRecord>>
      | null = null;

    if (resolutionMode === "now") {
      const selectedParticipantIds = includedUserIds && includedUserIds.length > 0
        ? includedUserIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
        : acceptedParticipants.map((participant) => participant.id);

      directSplitResult = await createDirectSplitRoundRecord(tx, {
        eventId: bbqId,
        createdByUserId: sessionUserId,
        title: created.item,
        amount,
        paidByParticipantId: created.participantId,
        splitWithParticipantIds: selectedParticipantIds,
      });

      if (directSplitResult.code !== "created" || !directSplitResult.settlementId) {
        return {
          code: directSplitResult.code,
          directSplitResult,
        } as const;
      }

      const updatedExpense = await expenseRepo.update(created.id, {
        linkedSettlementRoundId: directSplitResult.settlementId,
      }, tx);
      createdWithResolution = updatedExpense ?? created;
    }

    const [activityRow] = await tx.insert(planActivity).values({
      eventId: bbqId,
      type: "EXPENSE_ADDED",
      actorUserId: req.session?.userId ?? null,
      actorName,
      message: resolutionMode === "now"
        ? `${actorName} added ${created.item}${paidBySuffix} and settled it now (${currency}${Number(created.amount).toFixed(2)})`
        : `${actorName} added ${created.item}${paidBySuffix} (${currency}${Number(created.amount).toFixed(2)})`,
      meta: {
        expenseId: created.id,
        title: created.item,
        amount: Number(created.amount),
        currency: bbq.currency ?? null,
        resolutionMode,
        linkedSettlementRoundId: createdWithResolution.linkedSettlementRoundId ?? null,
        createdByUserId: sessionUserId,
        payerUserId: payerParticipant.userId ?? null,
      },
      createdAt: new Date(),
    }).returning();

    return {
      code: "created",
      created,
      createdWithResolution,
      activityRow: activityRow ?? null,
      directSplitResult,
    } as const;
  });

  if (txResult.code === "active_settlement_exists") {
    res.status(409).json({
      code: "active_settlement_exists",
      message: "Finish the active payback before starting a new one.",
      active: txResult.directSplitResult.detail,
    });
    return;
  }

  if (txResult.code !== "created") {
    res.status(400).json({
      code: "invalid_direct_split",
      message: "Choose who should pay this back now.",
    });
    return;
  }

  const createdResult = txResult as Extract<typeof txResult, { code: "created" }>;
  const { created, createdWithResolution, activityRow, directSplitResult } = createdResult;
  const amount = Number(created.amount);
  broadcastPlanActivityCreated(bbqId, activityRow);
  if (directSplitResult?.code === "created" && directSplitResult.settlementId) {
    const directSplitAmount = Number((directSplitResult.amountCents / 100).toFixed(2));
    await logPlanActivity({
      eventId: bbqId,
      type: "SETTLEMENT_STARTED",
      actorUserId: sessionUserId,
      actorName,
      message: `${actorName} paid for ${directSplitResult.title}`,
      meta: {
        settlementRoundId: directSplitResult.settlementId,
        title: directSplitResult.title,
        roundType: "direct_split",
        amount: directSplitAmount,
        currency: directSplitResult.currency,
        paidByUserId: directSplitResult.paidByUserId,
        paidByName: directSplitResult.paidByName,
        selectedParticipantIds: directSplitResult.selectedParticipantIds,
      },
    });
    await postSystemChatMessage(bbqId, `${actorName} paid for ${directSplitResult.title}`, {
      type: "settlement",
      action: "started",
      settlementRoundId: directSplitResult.settlementId,
      title: directSplitResult.title,
      roundType: "direct_split",
      amount: directSplitAmount,
      currency: directSplitResult.currency,
      paidByUserId: directSplitResult.paidByUserId,
      paidByName: directSplitResult.paidByName,
      selectedParticipantIds: directSplitResult.selectedParticipantIds,
    });
    broadcastEventRealtime(bbqId, {
      type: "settlement:started",
      eventId: bbqId,
      settlementRoundId: directSplitResult.settlementId,
    });
  }
  await postSystemChatMessage(
    bbqId,
    resolutionMode === "now"
      ? `${actorName} added ${created.item}${paidBySuffix} and settled it now (${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"})`
      : `${actorName} added ${created.item}${paidBySuffix} (${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"})`,
    {
    type: "expense",
    action: "added",
    expenseId: created.id,
    item: created.item,
    amount: Number.isFinite(amount) ? amount : 0,
    currency,
    paidBy: paidByName,
    actorName,
    resolutionMode,
    linkedSettlementRoundId: createdWithResolution.linkedSettlementRoundId ?? null,
    createdByUserId: sessionUserId,
    payerUserId: payerParticipant.userId ?? null,
  });
  await broadcastPlanBalancesUpdated(bbqId);
  res.status(201).json(createdWithResolution);
}));

router.put(p(api.expenses.update.path), requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.id);
  if (!Number.isInteger(expenseId) || expenseId <= 0) badRequest("Invalid expense id");
  const sessionUserId = req.session?.userId;
  if (!sessionUserId) unauthorized("Not authenticated");
  const bodySchema = api.expenses.update.input.extend({
    amount: z.coerce.number().optional(),
    participantId: z.coerce.number().optional(),
    includedUserIds: z.array(z.string()).optional().nullable(),
  });
  const input = bodySchema.parse(req.body);
  const [before] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!before) notFound("Expense not found");
  try {
    await assertExpensesWritable(before.barbecueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "This expense cannot be edited in the current plan state.";
    res.status(403).json({
      code: "expense_not_editable_in_current_state",
      message,
    });
    return;
  }
  if (
    before.linkedSettlementRoundId
    || before.settledAt
    || before.excludedFromFinalSettlement
    || before.resolutionMode === "now"
  ) {
    res.status(409).json({
      code: "expense_not_editable_in_current_state",
      message: "This expense is already tied to settlement progress and can no longer be edited.",
    });
    return;
  }
  const bbq = await getBarbecueOr404(req, before.barbecueId);
  const isCreator = bbq.creatorUserId === sessionUserId;
  const acceptedParticipants = await participantRepo.listByBbq(before.barbecueId, "accepted");
  const acceptedParticipantIds = new Set(acceptedParticipants.map((participant) => participant.id));
  const nextParticipantId = input.participantId !== undefined ? Number(input.participantId) : Number(before.participantId);
  const payerParticipant = acceptedParticipants.find((participant) => participant.id === nextParticipantId);
  if (!payerParticipant) badRequest("Paid by must be a plan member");
  if (!isCreator && input.participantId !== undefined && payerParticipant.userId !== sessionUserId) {
    forbidden("Only the plan creator can change who paid");
  }
  const includedUserIds = normalizeIncludedUserIds(input.includedUserIds);
  const includedParticipantIds = parseParticipantIdList(includedUserIds);
  if (includedParticipantIds && includedParticipantIds.some((participantId) => !acceptedParticipantIds.has(participantId))) {
    badRequest("Split members must be accepted plan participants");
  }
  const txResult = await db.transaction(async (tx) => {
    const updated = await expenseRepo.update(expenseId, {
      ...input,
      ...(includedUserIds !== undefined ? { includedUserIds } : {}),
    }, tx);
    if (!updated) return null;
    const beforeIncluded = normalizeIncludedUserIds(before.includedUserIds) ?? null;
    const afterIncluded = normalizeIncludedUserIds(updated.includedUserIds) ?? null;
    const splitChanged = JSON.stringify(beforeIncluded) !== JSON.stringify(afterIncluded);
    const changed = (
      (input.item !== undefined && input.item !== before.item)
      || (input.category !== undefined && input.category !== before.category)
      || (input.amount !== undefined && Number(input.amount) !== Number(before.amount))
      || (input.participantId !== undefined && Number(input.participantId) !== Number(before.participantId))
      || splitChanged
    );

    let activityRow: typeof planActivity.$inferSelect | null = null;
    if (changed) {
      const actorName = req.session?.username || "Someone";
      const currency = bbq.currency ?? "€";
      const amount = Number(updated.amount);
      const [insertedActivity] = await tx.insert(planActivity).values({
        eventId: updated.barbecueId,
        type: "EXPENSE_UPDATED",
        actorUserId: req.session?.userId ?? null,
        actorName,
        message: `${actorName} edited ${updated.item} (${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"})`,
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

    return { updated, changed, activityRow } as const;
  });
  if (!txResult?.updated) notFound("Expense not found");
  const { updated, changed, activityRow } = txResult;
  if (changed) {
    const actorName = req.session?.username || "Someone";
    const currency = bbq.currency ?? "€";
    const amount = Number(updated.amount);
    broadcastPlanActivityCreated(updated.barbecueId, activityRow);
    await postSystemChatMessage(updated.barbecueId, `${actorName} updated ${updated.item}`, {
      type: "expense",
      action: "updated",
      expenseId: updated.id,
      item: updated.item,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      paidBy: payerParticipant.name || actorName,
    });
  }
  await broadcastPlanBalancesUpdated(updated.barbecueId);
  res.json(updated);
}));

router.delete(p(api.expenses.delete.path), requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.id);
  if (!Number.isInteger(expenseId) || expenseId <= 0) badRequest("Invalid expense id");
  const username = req.session?.username;
  const sessionUserId = req.session?.userId;
  if (!username || !sessionUserId) unauthorized("Not authenticated");

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense) notFound("Expense not found");
  await assertEventAccessOrThrow(req, expense.barbecueId);

  if (expense.createdByUserId == null || Number(expense.createdByUserId) !== Number(sessionUserId)) {
    res.status(403).json({
      code: "only_creator_can_delete_expense",
      message: "Only the person who created this expense can delete it.",
    });
    return;
  }

  try {
    await assertExpensesWritable(expense.barbecueId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Expenses are not writable in the current plan state.";
    res.status(403).json({
      code: "expense_not_writable_in_current_plan_state",
      message,
    });
    return;
  }

  if (expense.linkedSettlementRoundId || expense.settledAt || expense.excludedFromFinalSettlement || expense.resolutionMode === "now") {
    res.status(409).json({
      code: "expense_not_deletable_after_settlement",
      message: "This expense is already tied to settlement progress and can no longer be deleted.",
    });
    return;
  }

  const [bbq] = await db.select().from(barbecues).where(eq(barbecues.id, expense.barbecueId)).limit(1);
  if (!bbq) notFound("Event not found");

  const actorName = username || "Someone";
  const expenseTitle = expense.item?.trim() || "Expense";
  const amount = Number(expense.amount);
  const currency = bbq.currency ?? "€";
  const message = `${actorName} deleted ${expenseTitle}`;
  const paidByParticipant = expense.participantId
    ? await participantRepo.getById(Number(expense.participantId))
    : null;
  const paidByName = paidByParticipant?.name || actorName;

  const txResult = await db.transaction(async (tx) => {
    await expenseRepo.delete(expenseId, tx);
    const [activityRow] = await tx.insert(planActivity).values({
      eventId: expense.barbecueId,
      type: "EXPENSE_DELETED",
      actorUserId: req.session?.userId ?? null,
      actorName,
      message,
      meta: {
        expenseId,
        amount: Number.isFinite(amount) ? amount : null,
        currency: bbq.currency ?? null,
        title: expenseTitle,
      },
      createdAt: new Date(),
    }).returning();
    return { activityRow: activityRow ?? null } as const;
  });

  if (txResult.activityRow) {
    broadcastPlanActivityCreated(expense.barbecueId, txResult.activityRow);
    broadcastEventRealtime(expense.barbecueId, {
      type: "expense_deleted",
      eventId: expense.barbecueId,
      expenseId,
    });
  }

  await postSystemChatMessage(expense.barbecueId, message, {
    type: "expense",
    action: "deleted",
    expenseId,
    item: expenseTitle,
    amount: Number.isFinite(amount) ? amount : 0,
    currency,
    paidBy: paidByName,
  });
  await broadcastPlanBalancesUpdated(expense.barbecueId);
  res.status(204).send();
}));

router.post("/receipts/scan", requireAuth, receiptScanLimiter, asyncHandler(async (req, res) => {
  const payload = z.object({
    dataUrl: z.string().min(1),
  }).parse(req.body ?? {});

  const { mime, buffer } = parseReceiptDataUrl(payload.dataUrl);
  const reqId = getReqId(req);
  const userId = req.session?.userId ?? null;

  log("info", "receipt_scan_requested", {
    reqId,
    userId,
    mimeType: mime,
    sizeBytes: buffer.length,
  });

  try {
    const result = await scanReceiptWithVision({ buffer, mimeType: mime });
    log("info", "receipt_scan_succeeded", {
      reqId,
      userId,
      mimeType: mime,
      sizeBytes: buffer.length,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Receipt scan failed";
    log("warn", "receipt_scan_failed", {
      reqId,
      userId,
      mimeType: mime,
      sizeBytes: buffer.length,
      message,
    });
    res.status(502).json({
      message: message || "Receipt scan failed",
    });
  }
}));

router.post("/expenses/:expenseId/receipt", requireAuth, receiptUploadLimiter, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await assertExpensesWritable(expense.barbecueId);
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);

  const payload = z.object({
    dataUrl: z.string().min(1),
  }).parse(req.body ?? {});

  const { mime, buffer } = parseReceiptDataUrl(payload.dataUrl);
  const reqId = getReqId(req);
  const userId = req.session?.userId ?? null;

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  const ext = extensionByMime[mime] ?? "jpg";
  const fileName = `expense-${expenseId}-${randomUUID()}.${ext}`;
  const prevReceiptUrl = expense.receiptUrl ?? null;
  log("info", "expense_receipt_upload_requested", {
    reqId,
    userId,
    expenseId,
    eventId: expense.barbecueId,
    mimeType: mime,
    sizeBytes: buffer.length,
  });
  try {
    const receiptUrl = await uploadFile({
      key: `receipts/${fileName}`,
      buffer,
      mimeType: mime,
      localFallbackPath: path.join(RECEIPT_UPLOAD_DIR, fileName),
      localPublicPath: `/uploads/receipts/${fileName}`,
    });
    const updated = await expenseRepo.update(expenseId, {
      receiptUrl,
      receiptMime: mime,
      receiptUploadedAt: new Date(),
    });
    if (!updated) notFound("Expense not found");

    await deleteFile(prevReceiptUrl);
    log("info", "expense_receipt_upload_succeeded", {
      reqId,
      userId,
      expenseId,
      eventId: expense.barbecueId,
      mimeType: mime,
      sizeBytes: buffer.length,
    });

    res.json({
      expenseId,
      receiptUrl: updated.receiptUrl ?? null,
      receiptMime: updated.receiptMime ?? null,
      receiptUploadedAt: updated.receiptUploadedAt ?? null,
    });
  } catch (error) {
    log("error", "expense_receipt_upload_failed", {
      reqId,
      userId,
      expenseId,
      eventId: expense.barbecueId,
      mimeType: mime,
      sizeBytes: buffer.length,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}));

router.delete("/expenses/:expenseId/receipt", requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await assertExpensesWritable(expense.barbecueId);
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);
  const reqId = getReqId(req);
  const userId = req.session?.userId ?? null;

  try {
    await deleteFile(expense.receiptUrl);
    const updated = await expenseRepo.update(expenseId, {
      receiptUrl: null,
      receiptMime: null,
      receiptUploadedAt: null,
    });
    if (!updated) notFound("Expense not found");
    log("info", "expense_receipt_deleted", {
      reqId,
      userId,
      expenseId,
      eventId: expense.barbecueId,
    });
    res.json({ expenseId, receiptUrl: null });
  } catch (error) {
    log("error", "expense_receipt_delete_failed", {
      reqId,
      userId,
      expenseId,
      eventId: expense.barbecueId,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}));

router.get("/barbecues/:bbqId/expense-shares", requireAuth, asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const shares = await expenseRepo.getExpenseShares(bbq.id);
  res.json(shares);
}));

router.patch("/barbecues/:bbqId/expenses/:expenseId/share", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const expenseId = Number(req.params.expenseId);
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) notFound("BBQ not found");
  await assertExpensesWritable(bbqId);
  if (bbq.visibility !== "private") badRequest("Opt-in expenses are only available for private events");
  if (!bbq.allowOptInExpenses) badRequest("Opt-in expenses not enabled for this BBQ");
  const participantsList = await participantRepo.listByBbq(bbqId, "accepted");
  const myParticipant = participantsList.find((p) => p.userId === req.session!.userId);
  if (!myParticipant) forbidden("Not a participant of this BBQ");
  const [expenseRow] = await db.select().from(expenses).where(and(eq(expenses.id, expenseId), eq(expenses.barbecueId, bbqId)));
  if (!expenseRow) notFound("Expense not found");
  const schema = z.object({ in: z.boolean() });
  const { in: inShare } = schema.parse(req.body);
  await expenseRepo.setExpenseShare(expenseId, myParticipant.id, inShare);
  await broadcastPlanBalancesUpdated(bbqId);
  res.json({ ok: true });
}));

export default router;
