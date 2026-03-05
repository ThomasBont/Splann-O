// Expense routes: expense CRUD, receipt upload/delete, and expense shares.
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { promises as fs } from "fs";
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
import { postSystemChatMessage } from "../lib/systemChat";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import { asyncHandler, assertEventAccessOrThrow, ensurePrivateEventParticipantOrCreator, getBarbecueOr404, p } from "./_helpers";

const router = Router();
const RECEIPT_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/receipts");
const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024;

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

router.get(p(api.expenses.list.path), asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const items = await expenseRepo.listByBbq(bbq.id);
  res.json(items);
}));

router.post(p(api.expenses.create.path), asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const bbq = await getBarbecueOr404(req, bbqId);
  const sessionUserId = req.session?.userId;
  if (!sessionUserId) unauthorized("Not authenticated");
  const isCreator = bbq.creatorUserId === sessionUserId;
  const bodySchema = api.expenses.create.input.extend({
    amount: z.coerce.number(),
    participantId: z.coerce.number(),
    includedUserIds: z.array(z.string()).optional().nullable(),
  });
  const input = bodySchema.parse(req.body);
  const acceptedParticipants = await participantRepo.listByBbq(bbqId, "accepted");
  const payerParticipant = acceptedParticipants.find((participant) => participant.id === input.participantId);
  if (!payerParticipant) badRequest("Paid by must be a plan member");
  if (!isCreator && payerParticipant.userId !== sessionUserId) {
    forbidden("Only the plan creator can change who paid");
  }
  const { optInByDefault, ...expenseData } = input;
  const includedUserIds = normalizeIncludedUserIds(expenseData.includedUserIds);
  const created = await expenseRepo.create(
    { ...expenseData, barbecueId: bbqId, includedUserIds: includedUserIds === undefined ? null : includedUserIds },
    { optInByDefault },
  );
  const actor = await participantRepo.getById(input.participantId);
  const actorName = actor?.name || req.session?.username || "Someone";
  const paidByName = payerParticipant.name || actor?.name || req.session?.username || "Someone";
  const currency = bbq.currency ?? "€";
  const amount = Number(created.amount);
  await logPlanActivity({
    eventId: bbqId,
    type: "EXPENSE_ADDED",
    actorUserId: req.session?.userId ?? null,
    actorName,
    message: `${actorName} added an expense: ${created.item} (${currency}${Number(created.amount).toFixed(2)})`,
    meta: {
      expenseId: created.id,
      amount: Number(created.amount),
      currency: bbq.currency ?? null,
    },
  });
  await postSystemChatMessage(bbqId, `${actorName} added ${created.item} (${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"})`, {
    type: "expense",
    action: "added",
    expenseId: created.id,
    item: created.item,
    amount: Number.isFinite(amount) ? amount : 0,
    currency,
    paidBy: paidByName,
  });
  await broadcastPlanBalancesUpdated(bbqId);
  res.status(201).json(created);
}));

router.put(p(api.expenses.update.path), asyncHandler(async (req, res) => {
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
  const bbq = await getBarbecueOr404(req, before.barbecueId);
  const isCreator = bbq.creatorUserId === sessionUserId;
  const acceptedParticipants = await participantRepo.listByBbq(before.barbecueId, "accepted");
  const nextParticipantId = input.participantId !== undefined ? Number(input.participantId) : Number(before.participantId);
  const payerParticipant = acceptedParticipants.find((participant) => participant.id === nextParticipantId);
  if (!payerParticipant) badRequest("Paid by must be a plan member");
  if (!isCreator && input.participantId !== undefined && payerParticipant.userId !== sessionUserId) {
    forbidden("Only the plan creator can change who paid");
  }
  const includedUserIds = normalizeIncludedUserIds(input.includedUserIds);
  const updated = await expenseRepo.update(expenseId, {
    ...input,
    ...(includedUserIds !== undefined ? { includedUserIds } : {}),
  });
  if (!updated) notFound("Expense not found");
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
  if (changed) {
    const actorName = req.session?.username || "Someone";
    const currency = bbq.currency ?? "€";
    const amount = Number(updated.amount);
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
  if (!username) unauthorized("Not authenticated");

  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!expense) notFound("Expense not found");
  await assertEventAccessOrThrow(req, expense.barbecueId);

  const [bbq] = await db.select().from(barbecues).where(eq(barbecues.id, expense.barbecueId)).limit(1);
  if (!bbq) notFound("Event not found");

  const actorName = username || "Someone";
  const expenseTitle = expense.item?.trim() || "Expense";
  const amount = Number(expense.amount);
  const currency = bbq.currency ?? "€";
  const message = `${actorName} deleted an expense: ${expenseTitle} (${currency}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"})`;
  const paidByParticipant = expense.participantId
    ? await participantRepo.getById(Number(expense.participantId))
    : null;
  const paidByName = paidByParticipant?.name || actorName;

  const createdActivity = await db.transaction(async (tx) => {
    await tx.delete(expenses).where(eq(expenses.id, expenseId));
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
    return activityRow ?? null;
  });

  if (createdActivity) {
    broadcastEventRealtime(expense.barbecueId, {
      type: "PLAN_ACTIVITY_CREATED",
      eventId: expense.barbecueId,
      activity: {
        id: createdActivity.id,
        eventId: createdActivity.eventId,
        type: createdActivity.type,
        actorUserId: createdActivity.actorUserId ?? null,
        actorName: createdActivity.actorName ?? null,
        message: createdActivity.message,
        meta: createdActivity.meta ?? null,
        createdAt: createdActivity.createdAt ? createdActivity.createdAt.toISOString() : new Date().toISOString(),
      },
    });
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

router.post("/expenses/:expenseId/receipt", requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);

  const payload = z.object({
    dataUrl: z.string().min(1),
  }).parse(req.body ?? {});

  const match = payload.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid receipt image");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]);
  if (!allowedMime.has(mime)) badRequest("Unsupported image type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid image payload");
  if (buffer.length > MAX_RECEIPT_SIZE_BYTES) badRequest("Receipt image must be 5MB or smaller");

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extensionByMime[mime] ?? "jpg";
  const fileName = `expense-${expenseId}-${randomUUID()}.${ext}`;
  await fs.mkdir(RECEIPT_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(RECEIPT_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  const prevReceiptUrl = expense.receiptUrl ?? null;
  const receiptUrl = `/uploads/receipts/${fileName}`;
  const updated = await expenseRepo.update(expenseId, {
    receiptUrl,
    receiptMime: mime,
    receiptUploadedAt: new Date(),
  });
  if (!updated) notFound("Expense not found");

  if (prevReceiptUrl?.startsWith("/uploads/receipts/")) {
    const oldPath = path.join(RECEIPT_UPLOAD_DIR, path.basename(prevReceiptUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  res.json({
    expenseId,
    receiptUrl: updated.receiptUrl ?? null,
    receiptMime: updated.receiptMime ?? null,
    receiptUploadedAt: updated.receiptUploadedAt ?? null,
  });
}));

router.delete("/expenses/:expenseId/receipt", requireAuth, asyncHandler(async (req, res) => {
  const expenseId = Number(req.params.expenseId);
  if (!Number.isFinite(expenseId)) badRequest("Invalid expense id");
  const [expense] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!expense) notFound("Expense not found");
  await ensurePrivateEventParticipantOrCreator(req, expense.barbecueId);

  if (expense.receiptUrl?.startsWith("/uploads/receipts/")) {
    const oldPath = path.join(RECEIPT_UPLOAD_DIR, path.basename(expense.receiptUrl));
    await fs.unlink(oldPath).catch(() => undefined);
  }

  const updated = await expenseRepo.update(expenseId, {
    receiptUrl: null,
    receiptMime: null,
    receiptUploadedAt: null,
  });
  if (!updated) notFound("Expense not found");
  res.json({ expenseId, receiptUrl: null });
}));

router.get("/barbecues/:bbqId/expense-shares", asyncHandler(async (req, res) => {
  const bbq = await getBarbecueOr404(req, Number(req.params.bbqId));
  const shares = await expenseRepo.getExpenseShares(bbq.id);
  res.json(shares);
}));

router.patch("/barbecues/:bbqId/expenses/:expenseId/share", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  const expenseId = Number(req.params.expenseId);
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) notFound("BBQ not found");
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
