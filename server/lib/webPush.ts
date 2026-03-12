import { eq } from "drizzle-orm";
import webpush from "web-push";
import { pushSubscriptions } from "@shared/schema";
import { db } from "../db";
import { resolveVapidPrivateKey, resolveVapidPublicKey, resolveVapidSubject } from "../config/env";
import { log } from "./logger";

let vapidConfigured = false;
let vapidWarningLogged = false;

export type PushPreferences = {
  chatMessages: boolean;
  expenses: boolean;
  paymentRequests: boolean;
  planInvites: boolean;
};

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  chatMessages: true,
  expenses: true,
  paymentRequests: true,
  planInvites: true,
};

export type PushPreferenceKey = keyof typeof DEFAULT_PUSH_PREFERENCES;

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

function normalizePreferences(value: unknown): PushPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_PUSH_PREFERENCES };
  const raw = value as Partial<Record<PushPreferenceKey, unknown>>;
  return {
    chatMessages: typeof raw.chatMessages === "boolean" ? raw.chatMessages : DEFAULT_PUSH_PREFERENCES.chatMessages,
    expenses: typeof raw.expenses === "boolean" ? raw.expenses : DEFAULT_PUSH_PREFERENCES.expenses,
    paymentRequests: typeof raw.paymentRequests === "boolean" ? raw.paymentRequests : DEFAULT_PUSH_PREFERENCES.paymentRequests,
    planInvites: typeof raw.planInvites === "boolean" ? raw.planInvites : DEFAULT_PUSH_PREFERENCES.planInvites,
  };
}

export async function sendPushToUser(
  userId: number,
  title: string,
  body: string,
  url?: string,
  preferenceKey: PushPreferenceKey = "expenses",
): Promise<void> {
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
    const preferences = normalizePreferences(subscription.pushPreferences);
    if (!preferences[preferenceKey]) return;
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
