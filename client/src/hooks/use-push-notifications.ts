"use client";

import * as React from "react";
import { apiRequest } from "@/lib/queryClient";

type PushPermission = NotificationPermission;

type UsePushNotificationsResult = {
  isSupported: boolean;
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
};

function isPushSupported(): boolean {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  return Uint8Array.from(Array.from(rawData, (char) => char.charCodeAt(0)));
}

async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/push-sw.js");
  await navigator.serviceWorker.ready;
  return registration;
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await ensurePushServiceWorker();
  return registration.pushManager.getSubscription();
}

export function usePushNotifications(): UsePushNotificationsResult {
  const supported = isPushSupported();
  const [permission, setPermission] = React.useState<PushPermission>(
    supported ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!supported) {
      setPermission("default");
      setIsSubscribed(false);
      return;
    }
    setPermission(Notification.permission);
    const subscription = await getCurrentSubscription();
    setIsSubscribed(Boolean(subscription));
  }, [supported]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = React.useCallback(async () => {
    if (!supported) {
      throw new Error("Push notifications are not supported on this device.");
    }
    setIsLoading(true);
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        throw new Error("Push notification permission was not granted.");
      }

      const keyResponse = await fetch("/api/push/vapid-public-key", {
        credentials: "include",
      });
      if (!keyResponse.ok) {
        const text = (await keyResponse.text()) || "Unable to start push notifications.";
        throw new Error(text);
      }
      const { publicKey } = (await keyResponse.json()) as { publicKey?: string };
      if (!publicKey) {
        throw new Error("Push notifications are not configured.");
      }

      const registration = await ensurePushServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = subscription.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!subscription.endpoint || !p256dh || !auth) {
        throw new Error("Push subscription is missing required keys.");
      }

      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      });

      setIsSubscribed(true);
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  const unsubscribe = React.useCallback(async () => {
    if (!supported) return;
    setIsLoading(true);
    try {
      const subscription = await getCurrentSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      await apiRequest("DELETE", "/api/push/unsubscribe", {
        endpoint: subscription.endpoint,
      });
      await subscription.unsubscribe();
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  }, [supported]);

  return {
    isSupported: supported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}
