import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "@shared/schema";
import { db } from "../db";
import { resolveVapidPrivateKey, resolveVapidPublicKey, resolveVapidSubject } from "../config/env";
import { log } from "./logger";

let vapidConfigured = false;
let vapidWarningLogged = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = resolveVapidPublicKey();
  const privateKey = resolveVapidPrivateKey();
  if (!publicKey || !privateKey) {
    if (!vapidWarningLogged) {
      vapidWarningLogged = true;
      log("warn", "Web push is disabled because VAPID keys are missing");
    }
    return false;
  }
  webpush.setVapidDetails(resolveVapidSubject(), publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

async function removeSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendPushToUser(userId: number, title: string, body: string, url?: string): Promise<void> {
  if (!ensureVapidConfigured()) return;

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) return;

  const payload = JSON.stringify({
    title,
    body,
    url: url ?? null,
  });

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
    } catch (error) {
      const statusCode =
        typeof error === "object" && error && "statusCode" in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;

      if (statusCode === 404 || statusCode === 410) {
        await removeSubscription(subscription.endpoint);
        return;
      }

      log("warn", "Failed to deliver web push notification", {
        userId,
        endpoint: subscription.endpoint,
        statusCode: statusCode ?? undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }));
}
