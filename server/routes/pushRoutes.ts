import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { pushSubscriptions } from "@shared/schema";
import { db } from "../db";
import { resolveVapidPublicKey } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "./_helpers";

const router = Router();

const subscribeSchema = z.object({
  endpoint: z.string().min(1),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().min(1),
});

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

router.post("/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  const { endpoint, p256dh, auth } = subscribeSchema.parse(req.body ?? {});

  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh,
      auth,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh,
        auth,
      },
    });

  res.status(201).json({ ok: true });
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
