"use client";

import * as React from "react";
import { apiRequest } from "@/lib/queryClient";

type PushPermission = NotificationPermission;
export type PushPreferences = {
  chatMessages: boolean;
  expenses: boolean;
  paymentRequests: boolean;
  planInvites: boolean;
};

const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  chatMessages: true,
  expenses: true,
  paymentRequests: true,
  planInvites: true,
};

type UsePushNotificationsResult = {
  isSupported: boolean;
  supportReason: "ok" | "insecure_context" | "unsupported_api" | "ios_home_screen_required";
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  preferences: PushPreferences;
  subscribe: (preferences?: PushPreferences) => Promise<void>;
  unsubscribe: () => Promise<void>;
  updatePreferences: (preferences: PushPreferences) => Promise<void>;
  refresh: () => Promise<void>;
};

function isPushSupported(): boolean {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator
    && "PushManager" in window;
}

function isAppleMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent;
  const touchMac = /Macintosh/.test(userAgent) && "ontouchend" in document;
  return /iPhone|iPad|iPod/.test(userAgent) || touchMac;
}

function isStandaloneWebApp(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.matchMedia?.("(display-mode: fullscreen)").matches
    || (typeof navigator !== "undefined" && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function getPushSupportReason(): "ok" | "insecure_context" | "unsupported_api" | "ios_home_screen_required" {
  if (typeof window === "undefined") return "unsupported_api";
  if (!isPushSupported()) return "unsupported_api";
  if (!window.isSecureContext) return "insecure_context";
  if (isAppleMobileDevice() && !isStandaloneWebApp()) return "ios_home_screen_required";
  return "ok";
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
  const supportReason = getPushSupportReason();
  const supported = supportReason === "ok";
  const [permission, setPermission] = React.useState<PushPermission>(
    supported ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [preferences, setPreferences] = React.useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);

  const refresh = React.useCallback(async () => {
    if (!supported) {
      setPermission("default");
      setIsSubscribed(false);
      setPreferences(DEFAULT_PUSH_PREFERENCES);
      return;
    }
    setPermission(Notification.permission);
    const subscription = await getCurrentSubscription();
    setIsSubscribed(Boolean(subscription));
    try {
      const res = await fetch("/api/push/preferences", { credentials: "include" });
      if (res.ok) {
        const body = (await res.json()) as { preferences?: PushPreferences };
        if (body.preferences) setPreferences(body.preferences);
      }
    } catch {
      // Keep local defaults when the settings endpoint is unavailable.
    }
  }, [supported]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const subscribe = React.useCallback(async (nextPreferences = preferences) => {
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
        preferences: nextPreferences,
      });

      setIsSubscribed(true);
      setPreferences(nextPreferences);
    } finally {
      setIsLoading(false);
    }
  }, [preferences, supported]);

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

  const updatePreferences = React.useCallback(async (nextPreferences: PushPreferences) => {
    setIsLoading(true);
    try {
      setPreferences(nextPreferences);
      if (!isSubscribed) return;
      await apiRequest("PATCH", "/api/push/preferences", nextPreferences);
    } finally {
      setIsLoading(false);
    }
  }, [isSubscribed]);

  return {
    isSupported: supported,
    supportReason,
    permission,
    isSubscribed,
    isLoading,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    refresh,
  };
}
