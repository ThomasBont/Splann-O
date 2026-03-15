import { useEffect, useMemo, useRef, useState } from "react";
import { getEventChatWsUrl } from "@/lib/network";

export type RealtimeConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "offline" | "error";

export type EventRealtimeSnapshot = {
  status: RealtimeConnectionStatus;
  isSubscribed: boolean;
  readyState: number;
  reconnectAttempt: number;
  connectedVersion: number;
  lastMessageAt: number | null;
};

type MessageListener = (payload: unknown) => void;
type StateListener = (snapshot: EventRealtimeSnapshot) => void;

function randomBackoffMs(attempt: number): number {
  const base = Math.min(10000, Math.max(1000, 1000 * 2 ** Math.max(0, attempt - 1)));
  const jitter = Math.floor(Math.random() * 300);
  return base + jitter;
}

class EventRealtimeClient {
  private ws: WebSocket | null = null;
  private retainCount = 0;
  private reconnectTimer: number | null = null;
  private subscribeTimeout: number | null = null;
  private messageListeners = new Set<MessageListener>();
  private stateListeners = new Set<StateListener>();
  private reconnectAttempt = 0;
  private connectedVersion = 0;
  private lastMessageAt: number | null = null;
  private manuallyClosed = false;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private hiddenAt: number | null = null;
  private snapshot: EventRealtimeSnapshot = {
    status: "idle",
    isSubscribed: false,
    readyState: WebSocket.CLOSED,
    reconnectAttempt: 0,
    connectedVersion: 0,
    lastMessageAt: null,
  };

  constructor(private readonly eventId: number) {}

  retain() {
    this.retainCount += 1;
    if (this.retainCount === 1) {
      this.attachWindowListeners();
      this.connect();
    } else {
      this.emitState();
    }
  }

  release() {
    this.retainCount = Math.max(0, this.retainCount - 1);
    if (this.retainCount === 0) {
      this.disconnect(true);
      this.detachWindowListeners();
      this.setSnapshot({
        status: "idle",
        isSubscribed: false,
        readyState: WebSocket.CLOSED,
        reconnectAttempt: 0,
      });
    }
  }

  subscribe(listener: MessageListener) {
    this.messageListeners.add(listener);
    return () => {
      this.messageListeners.delete(listener);
    };
  }

  subscribeState(listener: StateListener) {
    this.stateListeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  getSnapshot() {
    return this.snapshot;
  }

  send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.snapshot.isSubscribed) return false;
    this.ws.send(JSON.stringify(payload));
    return true;
  }

  reconnectNow() {
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.disconnect(false);
    this.connect();
  }

  private attachWindowListeners() {
    if (typeof window === "undefined" || this.onlineHandler || this.offlineHandler || this.visibilityHandler) return;
    this.onlineHandler = () => {
      if (this.retainCount <= 0) return;
      this.reconnectNow();
    };
    this.offlineHandler = () => {
      if (this.retainCount <= 0) return;
      this.setSnapshot({
        status: "offline",
        isSubscribed: false,
      });
      this.disconnect(false);
    };
    this.visibilityHandler = () => {
      if (this.retainCount <= 0 || typeof document === "undefined") return;
      if (document.hidden) {
        this.hiddenAt = Date.now();
        return;
      }
      const hiddenDuration = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
      this.hiddenAt = null;
      const shouldReconnect =
        hiddenDuration > 20_000
        || this.snapshot.status === "offline"
        || this.snapshot.status === "error"
        || !this.snapshot.isSubscribed
        || !this.ws
        || this.ws.readyState !== WebSocket.OPEN;
      if (shouldReconnect) {
        this.reconnectNow();
      }
    };
    window.addEventListener("online", this.onlineHandler);
    window.addEventListener("offline", this.offlineHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private detachWindowListeners() {
    if (typeof window === "undefined") return;
    if (this.onlineHandler) window.removeEventListener("online", this.onlineHandler);
    if (this.offlineHandler) window.removeEventListener("offline", this.offlineHandler);
    if (typeof document !== "undefined" && this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
    this.onlineHandler = null;
    this.offlineHandler = null;
    this.visibilityHandler = null;
    this.hiddenAt = null;
  }

  private connect() {
    if (this.retainCount <= 0) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setSnapshot({
        status: "offline",
        isSubscribed: false,
        readyState: WebSocket.CLOSED,
        reconnectAttempt: this.reconnectAttempt,
      });
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    this.manuallyClosed = false;
    this.setSnapshot({
      status: this.reconnectAttempt > 0 ? "reconnecting" : "connecting",
      isSubscribed: false,
      readyState: WebSocket.CONNECTING,
      reconnectAttempt: this.reconnectAttempt,
    });

    const ws = new WebSocket(getEventChatWsUrl(this.eventId));
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.setSnapshot({ readyState: ws.readyState });
      ws.send(JSON.stringify({ type: "event:subscribe", eventId: this.eventId }));
      this.clearSubscribeTimeout();
      this.subscribeTimeout = window.setTimeout(() => {
        if (this.ws === ws && !this.snapshot.isSubscribed) {
          ws.close();
        }
      }, 5000);
    };

    ws.onmessage = (event) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      this.lastMessageAt = Date.now();
      this.setSnapshot({ lastMessageAt: this.lastMessageAt });
      const message = payload as { type?: string };
      if (message?.type === "event:subscribed") {
        this.reconnectAttempt = 0;
        this.connectedVersion += 1;
        this.clearSubscribeTimeout();
        this.setSnapshot({
          status: "connected",
          isSubscribed: true,
          readyState: ws.readyState,
          reconnectAttempt: 0,
          connectedVersion: this.connectedVersion,
        });
      }
      for (const listener of Array.from(this.messageListeners)) listener(payload);
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.setSnapshot({
        status: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error",
      });
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.clearSubscribeTimeout();
      this.setSnapshot({
        isSubscribed: false,
        readyState: WebSocket.CLOSED,
      });
      if (this.manuallyClosed || this.retainCount <= 0) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        this.setSnapshot({ status: "offline" });
        return;
      }
      this.reconnectAttempt += 1;
      this.setSnapshot({
        status: "reconnecting",
        reconnectAttempt: this.reconnectAttempt,
      });
      this.clearReconnectTimer();
      this.reconnectTimer = window.setTimeout(() => {
        this.connect();
      }, randomBackoffMs(this.reconnectAttempt));
    };
  }

  private disconnect(manual: boolean) {
    this.manuallyClosed = manual;
    this.clearReconnectTimer();
    this.clearSubscribeTimeout();
    if (this.ws) {
      const current = this.ws;
      this.ws = null;
      current.close();
    }
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearSubscribeTimeout() {
    if (this.subscribeTimeout != null) {
      window.clearTimeout(this.subscribeTimeout);
      this.subscribeTimeout = null;
    }
  }

  private setSnapshot(partial: Partial<EventRealtimeSnapshot>) {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
      reconnectAttempt: partial.reconnectAttempt ?? this.reconnectAttempt,
      connectedVersion: partial.connectedVersion ?? this.connectedVersion,
      lastMessageAt: partial.lastMessageAt ?? this.lastMessageAt,
      readyState: partial.readyState ?? (this.ws?.readyState ?? WebSocket.CLOSED),
    };
    this.emitState();
  }

  private emitState() {
    for (const listener of Array.from(this.stateListeners)) listener(this.snapshot);
  }
}

const clients = new Map<number, EventRealtimeClient>();

export function getEventRealtimeClient(eventId: number) {
  const existing = clients.get(eventId);
  if (existing) return existing;
  const client = new EventRealtimeClient(eventId);
  clients.set(eventId, client);
  return client;
}

export function useEventRealtime(
  eventId: number | null,
  enabled = true,
  onMessage?: MessageListener,
) {
  const callbackRef = useRef<MessageListener | undefined>(onMessage);
  callbackRef.current = onMessage;
  const client = useMemo(() => (eventId ? getEventRealtimeClient(eventId) : null), [eventId]);
  const [snapshot, setSnapshot] = useState<EventRealtimeSnapshot>({
    status: enabled && eventId ? "connecting" : "idle",
    isSubscribed: false,
    readyState: -1,
    reconnectAttempt: 0,
    connectedVersion: 0,
    lastMessageAt: null,
  });

  useEffect(() => {
    if (!enabled || !client) {
      setSnapshot({
        status: "idle",
        isSubscribed: false,
        readyState: -1,
        reconnectAttempt: 0,
        connectedVersion: 0,
        lastMessageAt: null,
      });
      return;
    }

    client.retain();
    const unsubscribeState = client.subscribeState((next) => setSnapshot(next));
    const unsubscribeMessage = client.subscribe((payload) => {
      callbackRef.current?.(payload);
    });

    return () => {
      unsubscribeMessage();
      unsubscribeState();
      client.release();
    };
  }, [client, enabled]);

  return {
    ...snapshot,
    send: (payload: unknown) => (client ? client.send(payload) : false),
    reconnectNow: () => client?.reconnectNow(),
  };
}
