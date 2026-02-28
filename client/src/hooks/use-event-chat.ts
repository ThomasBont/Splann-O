import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  eventId: string;
  type: "user" | "system";
  text: string;
  createdAt: string;
  user?: { id: string; name: string; avatarUrl?: string | null };
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

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
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [retryTick, setRetryTick] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  const fetchHistory = useCallback(async () => {
    if (!eventId || !enabled) {
      setMessages([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/chat?limit=50`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { message?: string })?.message || "Failed to load chat");
      }
      const raw = body as { messages?: unknown };
      const incoming = Array.isArray(raw.messages) ? (raw.messages as ChatMessage[]) : [];
      setMessages(incoming);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Failed to load chat history");
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [enabled, eventId]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory, retryTick]);

  useEffect(() => {
    if (!enabled || !eventId) {
      setConnectionStatus("idle");
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      return;
    }

    let closedByCleanup = false;
    setConnectionStatus(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

    const ws = new WebSocket(getWsUrl(eventId));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      setConnectionStatus("connected");
    };

    ws.onmessage = (ev) => {
      let payload: { type?: string; message?: ChatMessage } | null = null;
      try {
        payload = JSON.parse(ev.data as string);
      } catch {
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

  const sendMessage = useCallback(async (text: string, actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null }) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;

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
    ws.send(JSON.stringify({ type: "send", text: trimmed }));
    return true;
  }, [eventId]);

  const retry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setRetryTick((n) => n + 1);
  }, []);

  return useMemo(() => ({
    messages,
    historyLoading,
    historyError,
    connectionStatus,
    sendMessage,
    retry,
  }), [messages, historyLoading, historyError, connectionStatus, sendMessage, retry]);
}
