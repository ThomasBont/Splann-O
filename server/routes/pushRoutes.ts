import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "@shared/schema";
import { db } from "../db";
import { resolveVapidPublicKey } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "./_helpers";
import { DEFAULT_PUSH_PREFERENCES, type PushPreferences } from "../lib/webPush";

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  preferences: z.object({
    chatMessages: z.boolean(),
    expenses: z.boolean(),
    paymentRequests: z.boolean(),
    planInvites: z.boolean(),
  }).optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1),
});

const preferencesSchema = z.object({
  chatMessages: z.boolean(),
  expenses: z.boolean(),
  paymentRequests: z.boolean(),
  planInvites: z.boolean(),
});

function normalizePreferences(value: unknown): PushPreferences {
  const parsed = preferencesSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...DEFAULT_PUSH_PREFERENCES };
}

router.get("/vapid-public-key", asyncHandler(async (_req, res) => {
  const publicKey = resolveVapidPublicKey();
  if (!publicKey) {
    res.status(503).json({
      code: "push_not_configured",
      message: "Push notifications are not configured.",
    });
    return;
  }
  res.json({ publicKey });
}));

router.get("/preferences", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const rows = await db
    .select({ pushPreferences: pushSubscriptions.pushPreferences })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  res.json({
    enabled: rows.length > 0,
    preferences: normalizePreferences(rows[0]?.pushPreferences),
  });
}));

router.post("/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const { endpoint, p256dh, auth, preferences } = subscribeSchema.parse(req.body ?? {});
  const nextPreferences = normalizePreferences(preferences);

  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh,
      auth,
      pushPreferences: nextPreferences,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh,
        auth,
        pushPreferences: nextPreferences,
      },
    });

  res.status(201).json({ ok: true });
}));

router.patch("/preferences", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const preferences = preferencesSchema.parse(req.body ?? {});

  await db
    .update(pushSubscriptions)
    .set({ pushPreferences: preferences })
    .where(eq(pushSubscriptions.userId, userId));

  res.json({ ok: true, preferences });
}));

router.delete("/unsubscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const { endpoint } = unsubscribeSchema.parse(req.body ?? {});

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));

  res.status(204).send();
}));

export default router;
