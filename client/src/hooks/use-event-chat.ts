import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  eventId: string;
  type: "user" | "system";
  text: string;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
};

export type TypingUser = {
  id: string;
  name: string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error" | "locked";
type SendBlockReason = "empty" | "locked" | "no-eventId" | "no-ws" | "not-open" | "not-subscribed" | "send-failed";

export type SendMessageResult = {
  ok: boolean;
  reason?: SendBlockReason;
  wsReadyState: number;
  isSubscribed: boolean;
};

function getWsUrl(eventId: number): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/events/${eventId}/chat`;
}

function mergeWithoutTempDuplicates(next: ChatMessage[]): ChatMessage[] {
  const hasStable = new Set(next.filter((m) => !m.id.startsWith("temp-")).map((m) => `${m.user?.id ?? "anon"}:${m.text}`));
  return next.filter((m) => !m.id.startsWith("temp-") || !hasStable.has(`${m.user?.id ?? "anon"}:${m.text}`));
}

export function useEventChat(eventId: number | null, enabled = true) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingOlder, setHistoryLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isLocked, setIsLocked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isLockedRef = useRef(false);

  const fetchHistoryPage = useCallback(async (before?: string | null) => {
    if (!eventId || !enabled) return { messages: [] as ChatMessage[], nextCursor: null as string | null, locked: false };
    const url = before
      ? `/api/plans/${eventId}/chat/messages?limit=50&before=${encodeURIComponent(before)}`
      : `/api/plans/${eventId}/chat/messages?limit=50`;
    const res = await fetch(url, { credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { message?: string })?.message || "Failed to load chat");
    }
    const raw = body as { messages?: unknown; nextCursor?: unknown; locked?: unknown };
    const incoming = Array.isArray(raw.messages) ? (raw.messages as ChatMessage[]) : [];
    return {
      messages: incoming,
      nextCursor: typeof raw.nextCursor === "string" && raw.nextCursor ? raw.nextCursor : null,
      locked: raw.locked === true,
    };
  }, [enabled, eventId]);

  const fetchInitialHistory = useCallback(async () => {
    if (!eventId || !enabled) {
      setMessages([]);
      setNextCursor(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    setIsLocked(false);
    isLockedRef.current = false;
    try {
      const page = await fetchHistoryPage(null);
      setMessages(page.messages);
      setNextCursor(page.nextCursor);
      setIsLocked(page.locked);
      if (page.locked) setConnectionStatus("locked");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Failed to load chat history");
      setMessages([]);
      setNextCursor(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [enabled, eventId, fetchHistoryPage]);

  const loadOlder = useCallback(async () => {
    if (!eventId || !enabled || !nextCursor || historyLoadingOlder) return;
    setHistoryLoadingOlder(true);
    try {
      const page = await fetchHistoryPage(nextCursor);
      setMessages((prev) => [...page.messages, ...prev]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Failed to load older chat history");
    } finally {
      setHistoryLoadingOlder(false);
    }
  }, [enabled, eventId, fetchHistoryPage, historyLoadingOlder, nextCursor]);

  useEffect(() => {
    void fetchInitialHistory();
  }, [fetchInitialHistory, retryTick]);

  useEffect(() => {
    if (!enabled || !eventId) {
      setConnectionStatus("idle");
      setIsLocked(false);
      setIsSubscribed(false);
      setTypingUsers([]);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      isLockedRef.current = false;
      return;
    }

    let closedByCleanup = false;
    isLockedRef.current = false;
    setIsSubscribed(false);
    setConnectionStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

    const ws = new WebSocket(getWsUrl(eventId));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      ws.send(JSON.stringify({ type: "event:subscribe", eventId }));
    };

    ws.onmessage = (ev) => {
      let payload: { type?: string; message?: ChatMessage; eventId?: number; code?: string; text?: string; user?: TypingUser } | null = null;
      try {
        payload = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (payload?.type === "event:subscribed") {
        setIsSubscribed(true);
        if (!isLockedRef.current) setConnectionStatus("connected");
        return;
      }
      if (payload?.type === "event:chat_locked" || (payload?.type === "event:error" && payload.code === "CHAT_LOCKED")) {
        setIsLocked(true);
        isLockedRef.current = true;
        setConnectionStatus("locked");
        return;
      }
      if (payload?.type === "chat:system" && payload.text) {
        const systemText = payload.text;
        setMessages((prev) => [...prev, {
          id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          eventId: String(payload.eventId ?? eventId ?? ""),
          type: "system",
          text: systemText,
          createdAt: new Date().toISOString(),
        }]);
        return;
      }
      if (payload?.type === "chat:typing" && payload.user?.id) {
        const nextUser = { id: String(payload.user.id), name: payload.user.name || "Someone" };
        setTypingUsers((prev) => {
          const existing = prev.filter((u) => u.id !== nextUser.id);
          return [...existing, nextUser];
        });
        window.setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== nextUser.id));
        }, 3000);
        return;
      }
      if (payload?.type !== "message" || !payload.message) return;
      setMessages((prev) => {
        const deduped = prev.filter((m) => m.id !== payload!.message!.id);
        return mergeWithoutTempDuplicates([...deduped, payload.message!]);
      });
    };

    ws.onclose = () => {
      if (closedByCleanup) return;
      setIsSubscribed(false);
      if (isLockedRef.current) return;
      setConnectionStatus("reconnecting");
      reconnectAttemptRef.current += 1;
      const delay = Math.min(2000 * reconnectAttemptRef.current, 10000);
      reconnectTimerRef.current = window.setTimeout(() => {
        setRetryTick((n) => n + 1);
      }, delay);
    };

    ws.onerror = () => {
      setConnectionStatus("error");
    };

    return () => {
      closedByCleanup = true;
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, eventId, retryTick]);

  const sendMessage = useCallback(async (text: string, actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null }): Promise<SendMessageResult> => {
    const trimmed = text.trim();
    const ws = wsRef.current;
    const wsReadyState = ws?.readyState ?? -1;
    if (!trimmed) return { ok: false, reason: "empty", wsReadyState, isSubscribed };
    if (!eventId) return { ok: false, reason: "no-eventId", wsReadyState, isSubscribed };
    if (isLocked) return { ok: false, reason: "locked", wsReadyState, isSubscribed };
    if (!ws) return { ok: false, reason: "no-ws", wsReadyState, isSubscribed };
    if (ws.readyState !== WebSocket.OPEN) return { ok: false, reason: "not-open", wsReadyState, isSubscribed };
    if (!isSubscribed) return { ok: false, reason: "not-subscribed", wsReadyState, isSubscribed };

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      eventId: String(eventId ?? ""),
      type: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
      user: {
        id: String(actor?.id ?? "me"),
        name: actor?.name ?? "You",
        avatarUrl: actor?.avatarUrl ?? null,
      },
    };

    setMessages((prev) => [...prev, optimistic]);
    try {
      ws.send(JSON.stringify({ type: "send", text: trimmed }));
      return { ok: true, wsReadyState: ws.readyState, isSubscribed };
    } catch {
      setMessages((prev) => prev.filter((message) => message.id !== optimistic.id));
      return { ok: false, reason: "send-failed", wsReadyState: ws.readyState, isSubscribed };
    }
  }, [eventId, isLocked, isSubscribed]);

  const sendTyping = useCallback((actor?: { id?: string | number | null; name?: string | null }) => {
    const ws = wsRef.current;
    if (!eventId || isLocked || !isSubscribed || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({
        type: "typing",
        user: {
          id: String(actor?.id ?? "unknown"),
          name: actor?.name ?? "Someone",
        },
      }));
    } catch {
      // no-op
    }
  }, [eventId, isLocked, isSubscribed]);

  const retry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setRetryTick((n) => n + 1);
  }, []);

  return useMemo(() => ({
    messages,
    historyLoading,
    historyLoadingOlder,
    historyError,
    hasMoreHistory: !!nextCursor,
    connectionStatus,
    isLocked,
    isSubscribed,
    typingUsers,
    wsReadyState: wsRef.current?.readyState ?? -1,
    sendMessage,
    sendTyping,
    loadOlder,
    retry,
  }), [messages, historyLoading, historyLoadingOlder, historyError, nextCursor, connectionStatus, isLocked, isSubscribed, typingUsers, sendMessage, sendTyping, loadOlder, retry]);
}
