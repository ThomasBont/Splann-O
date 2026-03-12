// Event chat and reactions routes.
import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import path from "path";
import { randomUUID } from "crypto";
import { appendEventChatMessage, deleteEventChatMessage, editEventChatMessage, listEventChatMessages, toggleEventChatReaction } from "../lib/eventChatStore";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { requireAuth } from "../middleware/requireAuth";
import { badRequest } from "../lib/errors";
import { isEventChatLocked } from "../lib/eventChatPolicy";
import { assertEventAccessOrThrow, asyncHandler, toPublicUploadsUrl } from "./_helpers";
import { db } from "../db";
import { barbecues } from "@shared/schema";
import { uploadFile } from "../lib/r2";
import { getPlanLifecycleState } from "../lib/planLifecycle";

const router = Router();
const CHAT_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/chat");
const MAX_CHAT_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const FILE_EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/json": "json",
  "application/rtf": "rtf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
const IMAGE_MIME_TYPES = new Set(Object.keys(IMAGE_EXTENSION_BY_MIME));
const FILE_MIME_TYPES = new Set(Object.keys(FILE_EXTENSION_BY_MIME));

function sanitizeBaseName(input: string): string {
  const trimmed = input.trim();
  const parsed = path.parse(trimmed);
  const base = (parsed.name || trimmed || "attachment")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return base || "attachment";
}

async function uploadChatAttachment(
  req: Parameters<typeof asyncHandler>[0] extends (req: infer T, ...args: any[]) => any ? T : never,
  eventId: number,
  payload: unknown,
) {
  await assertEventAccessOrThrow(req, eventId);

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    return { locked: true as const };
  }

  const parsed = z.object({
    kind: z.enum(["image", "file"]),
    fileName: z.string().trim().min(1).max(200),
    dataUrl: z.string().min(1),
  }).parse(payload ?? {});

  const match = parsed.dataUrl.match(/^data:([a-zA-Z0-9.+/-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid attachment payload");
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const allowedMimeTypes = parsed.kind === "image" ? IMAGE_MIME_TYPES : FILE_MIME_TYPES;
  if (!allowedMimeTypes.has(mime)) badRequest(parsed.kind === "image" ? "Unsupported image type" : "Unsupported file type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid attachment payload");
  if (buffer.length > MAX_CHAT_ATTACHMENT_SIZE_BYTES) badRequest("Attachment must be 5MB or smaller");

  const extensionMap = parsed.kind === "image" ? IMAGE_EXTENSION_BY_MIME : FILE_EXTENSION_BY_MIME;
  const fallbackExtension = path.extname(parsed.fileName).replace(/^\./, "").toLowerCase();
  const extension = extensionMap[mime] ?? fallbackExtension ?? "bin";
  const baseName = sanitizeBaseName(parsed.fileName);
  const fileName = `chat-${eventId}-${randomUUID()}-${baseName}.${extension}`;

  const relativePath = await uploadFile({
    key: `chat/${fileName}`,
    buffer,
    mimeType: mime,
    localFallbackPath: path.join(CHAT_UPLOAD_DIR, fileName),
    localPublicPath: `/uploads/chat/${fileName}`,
  });
  return {
    locked: false as const,
    attachment: {
      kind: parsed.kind,
      fileName: parsed.fileName,
      mimeType: mime,
      size: buffer.length,
      path: relativePath,
      url: relativePath,
      publicUrl: /^https?:\/\//i.test(relativePath) ? relativePath : toPublicUploadsUrl(req, relativePath),
    },
  };
}

async function isChatLockedForEvent(eventId: number): Promise<boolean> {
  const lifecycle = await getPlanLifecycleState(eventId);
  if (lifecycle) return !lifecycle.socialOpen;
  const [event] = await db.select({ date: barbecues.date }).from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!event) return false;
  return isEventChatLocked({ date: event.date ?? null });
}

async function getChatLockPayload(eventId: number) {
  const lifecycle = await getPlanLifecycleState(eventId);
  if (lifecycle && !lifecycle.socialOpen) {
    if (lifecycle.status === "archived") {
      return { code: "CHAT_LOCKED", message: "This plan is archived. Chat is now read-only." };
    }
    if (lifecycle.status === "closed") {
      return { code: "CHAT_LOCKED", message: "This plan is closed. Chat is read-only." };
    }
  }
  return { code: "CHAT_LOCKED", message: "Chat is read-only for this plan." };
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

router.post("/plans/:planId/chat/attachments", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  const result = await uploadChatAttachment(req, eventId, req.body);
  if (result.locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }
  res.status(201).json(result.attachment);
}));

router.post("/plans/:planId/chat/messages", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().trim().min(1).max(200),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const saved = await appendEventChatMessage(eventId, {
    text: parsed.content,
    clientMessageId: parsed.clientMessageId,
    metadata: parsed.metadata ?? null,
    user: {
      id: String(req.session!.userId!),
      name: req.session!.username!,
    },
  });
  res.status(saved.inserted ? 201 : 200).json({ message: saved.message });
}));

router.post("/events/:eventId/chat/attachments", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  const result = await uploadChatAttachment(req, eventId, req.body);
  if (result.locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }
  res.status(201).json(result.attachment);
}));

router.post("/events/:eventId/chat/messages", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
    clientMessageId: z.string().trim().min(1).max(200),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const saved = await appendEventChatMessage(eventId, {
    text: parsed.content,
    clientMessageId: parsed.clientMessageId,
    metadata: parsed.metadata ?? null,
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

router.patch("/plans/:planId/chat/messages/:messageId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  const messageId = String(req.params.messageId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  if (!messageId) badRequest("Invalid message id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const message = await editEventChatMessage({
    eventId,
    messageId,
    userId: req.session!.userId!,
    text: parsed.content,
  });
  broadcastEventRealtime(eventId, { type: "chat:update", eventId, message });
  res.json({ message });
}));

router.delete("/plans/:planId/chat/messages/:messageId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.planId);
  const messageId = String(req.params.messageId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid plan id");
  if (!messageId) badRequest("Invalid message id");
  await assertEventAccessOrThrow(req, eventId);

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const deleted = await deleteEventChatMessage({
    eventId,
    messageId,
    userId: req.session!.userId!,
  });
  broadcastEventRealtime(eventId, { type: "chat:delete", eventId, messageId: deleted.messageId });
  res.json(deleted);
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

router.patch("/events/:eventId/chat/messages/:messageId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const messageId = String(req.params.messageId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  if (!messageId) badRequest("Invalid message id");
  await assertEventAccessOrThrow(req, eventId);
  const parsed = z.object({
    content: z.string().trim().min(1).max(2000),
  }).parse(req.body ?? {});

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const message = await editEventChatMessage({
    eventId,
    messageId,
    userId: req.session!.userId!,
    text: parsed.content,
  });
  broadcastEventRealtime(eventId, { type: "chat:update", eventId, message });
  res.json({ message });
}));

router.delete("/events/:eventId/chat/messages/:messageId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const messageId = String(req.params.messageId ?? "").trim();
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  if (!messageId) badRequest("Invalid message id");
  await assertEventAccessOrThrow(req, eventId);

  const locked = await isChatLockedForEvent(eventId);
  if (locked) {
    res.status(423).json(await getChatLockPayload(eventId));
    return;
  }

  const deleted = await deleteEventChatMessage({
    eventId,
    messageId,
    userId: req.session!.userId!,
  });
  broadcastEventRealtime(eventId, { type: "chat:delete", eventId, messageId: deleted.messageId });
  res.json(deleted);
}));

export default router;
