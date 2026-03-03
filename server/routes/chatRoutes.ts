// Event chat and reactions routes.
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { appendEventChatMessage, listEventChatMessages, toggleEventChatReaction } from "../lib/eventChatStore";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { requireAuth } from "../middleware/requireAuth";
import { badRequest } from "../lib/errors";
import { isEventChatLocked } from "../lib/eventChatPolicy";
import { assertEventAccessOrThrow, asyncHandler } from "./_helpers";
import { db } from "../db";
import { barbecues } from "@shared/schema";

const router = Router();

async function isChatLockedForEvent(eventId: number): Promise<boolean> {
  const [event] = await db.select({ date: barbecues.date }).from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!event) return false;
  return isEventChatLocked({ date: event.date ?? null });
}

router.get("/events/:eventId/chat", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);

  const limit = Number(req.query.limit ?? 50);
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const result = await listEventChatMessages(eventId, { limit, before });
  res.json(result);
}));

router.get("/plans/:planId/chat/messages", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, eventId);

  const limit = Number(req.query.limit ?? 50);
  const before = typeof req.query.before === "string" ? req.query.before : undefined;
  const result = await listEventChatMessages(eventId, { limit, before });
  res.json(result);
}));

router.post("/plans/:planId/chat/messages", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().trim().min(1).max(200),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json({ code: "CHAT_LOCKED", message: "Chat closed after event. History remains visible." });
    return;
  }

  const saved = await appendEventChatMessage(eventId, {
    text: parsed.content,
    clientMessageId: parsed.clientMessageId,
    user: {
      id: String(req.session!.userId!),
      name: req.session!.username!,
    },
  });
  res.status(saved.inserted ? 201 : 200).json({ message: saved.message });
}));

router.post("/events/:eventId/chat/messages", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().trim().min(1).max(200),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json({ code: "CHAT_LOCKED", message: "Chat closed after event. History remains visible." });
    return;
  }

  const saved = await appendEventChatMessage(eventId, {
    text: parsed.content,
    clientMessageId: parsed.clientMessageId,
    user: {
      id: String(req.session!.userId!),
      name: req.session!.username!,
    },
  });

  if (saved.message && saved.inserted) {
    broadcastEventRealtime(eventId, { type: "chat:new", eventId, message: saved.message });
  }

  res.status(saved.inserted ? 201 : 200).json({ message: saved.message });
}));

router.post("/plans/:planId/chat/messages/:messageId/reactions", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  const messageId = String(req.params.messageId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  if (!messageId) badRequest("Invalid message id");
  await assertEventAccessOrThrow(req, eventId);

  const parsed = z.object({ emoji: z.string().trim().min(1).max(16) }).parse(req.body ?? {});
  const reactions = await toggleEventChatReaction({
    eventId,
    messageId,
    userId: req.session!.userId!,
    emoji: parsed.emoji,
  });

  broadcastEventRealtime(eventId, {
    type: "reaction:update",
    eventId,
    messageId,
    reactions,
  });
  res.json({ messageId, reactions });
}));

export default router;
