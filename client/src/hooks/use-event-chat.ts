import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBase, getEventChatWsUrl } from "@/lib/network";
import { planBalancesQueryKey, type RealtimePlanBalances } from "@/hooks/use-expenses";
import { dedupeExpenseSystemMessages } from "@/lib/chat/dedupe-expense-system-messages";
import { filterChatMessages } from "@/lib/chat/filter-chat-messages";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

export type ChatMessage = {
  id: string;
  eventId: string;
  clientMessageId?: string;
  type: "user" | "system";
  text: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  serverCreatedAt?: string;
  status?: "sending" | "sent" | "failed";
  optimistic?: boolean;
  user?: { id: string; name: string; avatarUrl?: string | null };
  reactions?: Array<{ emoji: string; count: number; me: boolean }>;
};

export type TypingUser = {
  id: string;
  name: string;
};

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error" | "locked";
type SendBlockReason = "empty" | "locked" | "no-eventId";

export type SendMessageResult = {
  ok: boolean;
  reason?: SendBlockReason;
  wsReadyState: number;
  isSubscribed: boolean;
};

type IncomingServerMessage = {
  id: string;
  eventId: string;
  clientMessageId?: string;
  type?: "user" | "system";
  text?: string;
  content?: string;
  metadata?: unknown;
  createdAt: string;
  serverCreatedAt?: string;
  reactions?: Array<{ emoji?: string; count?: number; me?: boolean }>;
  user?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null };
};

export type PlanMessagesPage = {
  messages: ChatMessage[];
  nextCursor: string | null;
  locked: boolean;
};

export function planMessagesQueryKey(planId: number | null) {
  return ["messages", planId] as const;
}

export async function fetchPlanMessages(planId: number, before?: string | null): Promise<PlanMessagesPage> {
  const planUrl = before
    ? `/api/plans/${planId}/chat/messages?limit=50&before=${encodeURIComponent(before)}`
    : `/api/plans/${planId}/chat/messages?limit=50`;
  const legacyUrl = before
    ? `/api/events/${planId}/chat?limit=50&before=${encodeURIComponent(before)}`
    : `/api/events/${planId}/chat?limit=50`;

  const load = async (url: string) => {
    const res = await fetch(url, { credentials: "include" });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

  let { res, body } = await load(planUrl);
  if (!res.ok && res.status === 404) {
    ({ res, body } = await load(legacyUrl));
  }
  if (!res.ok) throw new Error((body as { message?: string })?.message || "Failed to load chat");

  const raw = body as { messages?: unknown; nextCursor?: unknown; locked?: unknown };
  const incoming = Array.isArray(raw.messages)
    ? (raw.messages as IncomingServerMessage[])
      .map(normalizeIncomingMessage)
      .filter((message): message is ChatMessage => !!message)
    : [];

  return {
    messages: incoming,
    nextCursor: typeof raw.nextCursor === "string" && raw.nextCursor ? raw.nextCursor : null,
    locked: raw.locked === true,
  };
}

function createClientMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Keep server-side UUID validation happy even on non-secure contexts (e.g. LAN http).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

function normalizeIncomingMessage(raw: IncomingServerMessage): ChatMessage | null {
  const content = typeof raw.text === "string" ? raw.text : (typeof raw.content === "string" ? raw.content : "");
  if (!raw.id || !content) return null;
  const createdAt = raw.createdAt || new Date().toISOString();
  return {
    id: raw.id,
    eventId: String(raw.eventId ?? ""),
    clientMessageId: typeof raw.clientMessageId === "string" ? raw.clientMessageId : undefined,
    type: raw.type === "system" ? "system" : "user",
    text: content,
    metadata: (raw.metadata && typeof raw.metadata === "object") ? (raw.metadata as Record<string, unknown>) : null,
    createdAt,
    serverCreatedAt: raw.serverCreatedAt ?? createdAt,
    status: "sent",
    optimistic: false,
    reactions: Array.isArray(raw.reactions)
      ? raw.reactions
        .map((reaction) => {
          const emoji = typeof reaction?.emoji === "string" ? reaction.emoji : "";
          const count = typeof reaction?.count === "number" ? reaction.count : 0;
          if (!emoji || count <= 0) return null;
          return { emoji, count, me: reaction?.me === true };
        })
        .filter((reaction): reaction is { emoji: string; count: number; me: boolean } => !!reaction)
      : [],
    user: raw.user?.id != null
      ? {
          id: String(raw.user.id),
          name: raw.user?.name || "Unknown user",
          avatarUrl: raw.user?.avatarUrl ?? null,
        }
      : undefined,
  };
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const at = new Date(a.serverCreatedAt ?? a.createdAt).getTime();
  const bt = new Date(b.serverCreatedAt ?? b.createdAt).getTime();
  const aTime = Number.isFinite(at) ? at : 0;
  const bTime = Number.isFinite(bt) ? bt : 0;
  if (aTime !== bTime) return aTime - bTime;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function dedupeAndSort(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const byClient = new Map<string, string>();

  for (const message of messages) {
    const existingById = byId.get(message.id);
    if (existingById) {
      byId.set(message.id, {
        ...existingById,
        ...message,
        status: message.status ?? existingById.status,
        optimistic: message.optimistic ?? existingById.optimistic,
      });
      continue;
    }

    const clientId = message.clientMessageId?.trim();
    if (clientId && byClient.has(clientId)) {
      const winnerId = byClient.get(clientId)!;
      const winner = byId.get(winnerId);
      if (!winner) {
        byId.set(message.id, message);
        byClient.set(clientId, message.id);
        continue;
      }
      const preferServer = !winner.optimistic && !!winner.id && !winner.id.startsWith("optimistic:");
      const nextPreferServer = !message.optimistic && !!message.id && !message.id.startsWith("optimistic:");
      if (nextPreferServer || !preferServer) {
        byId.delete(winnerId);
        byId.set(message.id, { ...winner, ...message, status: message.status ?? "sent", optimistic: false });
        byClient.set(clientId, message.id);
      }
      continue;
    }

    byId.set(message.id, message);
    if (clientId) byClient.set(clientId, message.id);
  }

  const sorted = Array.from(byId.values()).sort(compareMessages);
  const deduped = dedupeExpenseSystemMessages(sorted);
  return filterChatMessages(deduped);
}

function randomBackoffMs(attempt: number): number {
  const base = Math.min(10000, Math.max(1000, 1000 * 2 ** (attempt - 1)));
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

export function useEventChat(eventId: number | null, enabled = true) {
  const queryClient = useQueryClient();
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
  const loggedTransportRef = useRef(false);
  const pendingAckTimersRef = useRef(new Map<string, number>());

  const clearPendingAck = useCallback((clientMessageId?: string | null) => {
    const id = typeof clientMessageId === "string" ? clientMessageId.trim() : "";
    if (!id) return;
    const timer = pendingAckTimersRef.current.get(id);
    if (timer != null) {
      window.clearTimeout(timer);
      pendingAckTimersRef.current.delete(id);
    }
  }, []);

  const mergeMessages = useCallback((incoming: ChatMessage[] | ChatMessage, mode: "append" | "prepend" = "append") => {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    setMessages((prev) => {
      const next = mode === "prepend" ? [...list, ...prev] : [...prev, ...list];
      return dedupeAndSort(next);
    });
  }, []);

  const markFailed = useCallback((clientMessageId?: string) => {
    if (!clientMessageId) return;
    clearPendingAck(clientMessageId);
    setMessages((prev) => prev.map((msg) => (
      msg.clientMessageId === clientMessageId ? { ...msg, status: "failed", optimistic: true } : msg
    )));
  }, [clearPendingAck]);

  const reconcileServerMessage = useCallback((serverMessage: ChatMessage, hintedClientMessageId?: string) => {
    setMessages((prev) => {
      const candidateClientMessageId = hintedClientMessageId || serverMessage.clientMessageId;
      clearPendingAck(candidateClientMessageId);
      if (import.meta.env.DEV && candidateClientMessageId) {
        console.log("[chat-ack-match]", {
          eventId,
          clientMessageId: candidateClientMessageId,
          serverMessageId: serverMessage.id,
          via: hintedClientMessageId ? "hinted" : "server-message",
        });
      }
      const next = prev.filter((msg) => {
        if (msg.id === serverMessage.id) return false;
        if (candidateClientMessageId && msg.clientMessageId === candidateClientMessageId) return false;
        return true;
      });
      next.push({ ...serverMessage, status: "sent", optimistic: false });
      return dedupeAndSort(next);
    });
  }, [clearPendingAck, eventId]);

  const applyReactionUpdate = useCallback((messageId: string, reactions: Array<{ emoji: string; count: number; me: boolean }>) => {
    setMessages((prev) => prev.map((message) => (
      message.id === messageId ? { ...message, reactions } : message
    )));
  }, []);

  const fetchHistoryPage = useCallback(async (before?: string | null) => {
    if (!eventId || !enabled) return { messages: [] as ChatMessage[], nextCursor: null as string | null, locked: false };
    if (import.meta.env.DEV) {
      console.log("[chat-history] fetch", { eventId, before: before ?? null });
    }
    const page = await fetchPlanMessages(eventId, before);
    if (import.meta.env.DEV) {
      console.log("[chat-history] loaded", {
        eventId,
        count: page.messages.length,
        nextCursor: page.nextCursor,
      });
      if (page.messages.length === 0) {
        console.warn("[chat-history] empty result; if messages are expected, verify DB persistence and eventId wiring", { eventId });
      }
    }
    return page;
  }, [enabled, eventId]);

  const fetchInitialHistory = useCallback(async () => {
    if (!eventId || !enabled) {
      setMessages([]);
      setNextCursor(null);
      return;
    }
    const cacheKey = planMessagesQueryKey(eventId);
    const cached = queryClient.getQueryData<PlanMessagesPage>(cacheKey);
    if (cached) {
      setMessages(dedupeAndSort(cached.messages));
      setNextCursor(cached.nextCursor);
      setIsLocked(cached.locked);
      if (cached.locked) setConnectionStatus("locked");
    }
    setHistoryLoading(!cached);
    setHistoryError(null);
    if (!cached) {
      setIsLocked(false);
      isLockedRef.current = false;
    }
    try {
      const page = await queryClient.fetchQuery({
        queryKey: cacheKey,
        queryFn: () => fetchHistoryPage(null),
        staleTime: PLAN_STALE_TIME_MS,
        gcTime: PLAN_GC_TIME_MS,
      });
      setMessages(dedupeAndSort(page.messages));
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
  }, [enabled, eventId, fetchHistoryPage, queryClient]);

  const loadOlder = useCallback(async () => {
    if (!eventId || !enabled || !nextCursor || historyLoadingOlder) return;
    setHistoryLoadingOlder(true);
    try {
      const page = await fetchHistoryPage(nextCursor);
      mergeMessages(page.messages, "prepend");
      setNextCursor(page.nextCursor);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Failed to load older chat history");
    } finally {
      setHistoryLoadingOlder(false);
    }
  }, [enabled, eventId, fetchHistoryPage, historyLoadingOlder, mergeMessages, nextCursor]);

  const sendViaHttp = useCallback(async (clientMessageId: string, text: string) => {
    if (!eventId) throw new Error("No event id");
    const endpoint = `/api/plans/${eventId}/chat/messages`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: text, clientMessageId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.error("[chat-send-http] failed", {
          eventId,
          endpoint,
          status: res.status,
          statusText: res.statusText,
          body,
        });
      }
      throw new Error((body as { message?: string }).message || `${res.status}: Failed to send message`);
    }
    const raw = (body as { message?: IncomingServerMessage }).message;
    const normalized = raw ? normalizeIncomingMessage(raw) : null;
    if (!normalized) throw new Error("Invalid message response");
    reconcileServerMessage(normalized, clientMessageId);
  }, [eventId, reconcileServerMessage]);

  useEffect(() => {
    void fetchInitialHistory();
  }, [fetchInitialHistory, retryTick]);

  useEffect(() => {
    if (!eventId || !enabled) return;
    queryClient.setQueryData<PlanMessagesPage>(planMessagesQueryKey(eventId), {
      messages,
      nextCursor,
      locked: isLocked,
    });
  }, [enabled, eventId, isLocked, messages, nextCursor, queryClient]);

  useEffect(() => {
    loggedTransportRef.current = false;
  }, [eventId]);

  useEffect(() => {
    if (!enabled || !eventId) {
      setConnectionStatus("idle");
      setIsLocked(false);
      setIsSubscribed(false);
      setTypingUsers([]);
      pendingAckTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingAckTimersRef.current.clear();
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

    const ws = new WebSocket(getEventChatWsUrl(eventId));
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptRef.current = 0;
      ws.send(JSON.stringify({ type: "event:subscribe", eventId }));
    };

    ws.onmessage = (ev) => {
      let payload: any = null;
      try {
        payload = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (import.meta.env.DEV) {
        console.log("[chat-ws:in]", {
          eventId,
          type: payload?.type ?? null,
          messageId: payload?.message?.id ?? null,
          clientMessageId: payload?.clientMessageId ?? payload?.message?.clientMessageId ?? null,
        });
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
        const systemMessage: ChatMessage = {
          id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          eventId: String(payload.eventId ?? eventId ?? ""),
          type: "system",
          text: payload.text,
          createdAt: new Date().toISOString(),
          serverCreatedAt: new Date().toISOString(),
          status: "sent",
          optimistic: false,
        };
        mergeMessages(systemMessage);
        return;
      }
      if ((payload?.type === "chat:typing" || payload?.type === "chat:typing_start") && payload.user?.id) {
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
      if ((payload?.type === "chat:typing_stop" || payload?.type === "typing:stop") && payload.user?.id) {
        const targetId = String(payload.user.id);
        setTypingUsers((prev) => prev.filter((u) => u.id !== targetId));
        return;
      }
      if (payload?.type === "chat:error") {
        if (import.meta.env.DEV) {
          console.error("[chat-send:error]", {
            eventId,
            clientMessageId: payload?.clientMessageId ?? null,
            code: payload?.code ?? null,
            message: payload?.message ?? null,
          });
        }
        markFailed(payload.clientMessageId);
        return;
      }
      if (payload?.type === "chat:reaction_update" && typeof payload.messageId === "string") {
        const reactions = Array.isArray(payload.reactions)
          ? payload.reactions
            .map((reaction: any) => {
              const emoji = typeof reaction?.emoji === "string" ? reaction.emoji : "";
              const count = Number(reaction?.count ?? 0);
              if (!emoji || !Number.isFinite(count) || count <= 0) return null;
              return { emoji, count, me: reaction?.me === true };
            })
            .filter((reaction: { emoji: string; count: number; me: boolean } | null): reaction is { emoji: string; count: number; me: boolean } => !!reaction)
          : [];
        applyReactionUpdate(payload.messageId, reactions);
        return;
      }
      if (payload?.type === "plan:balancesUpdated") {
        const planId = Number(payload.planId);
        if (!Number.isFinite(planId) || planId !== eventId) return;
        const parsed: RealtimePlanBalances = {
          type: "plan:balancesUpdated",
          planId,
          balances: Array.isArray(payload.balances) ? payload.balances : [],
          suggestedPaybacks: Array.isArray(payload.suggestedPaybacks) ? payload.suggestedPaybacks : [],
          updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
          version: typeof payload.version === "number" ? payload.version : Date.now(),
        };
        if (import.meta.env.DEV) {
          console.log("[realtime:balances:received]", {
            planId,
            balances: parsed.balances.length,
            suggestedPaybacks: parsed.suggestedPaybacks.length,
            version: parsed.version,
          });
        }
        queryClient.setQueryData(planBalancesQueryKey(planId), parsed);
        return;
      }
      if (payload?.type === "chat:ack") {
        const incoming = normalizeIncomingMessage(payload.message as IncomingServerMessage);
        if (!incoming) return;
        reconcileServerMessage(incoming, typeof payload.clientMessageId === "string" ? payload.clientMessageId : incoming.clientMessageId);
        return;
      }
      if (payload?.type === "chat:new") {
        const incoming = normalizeIncomingMessage(payload.message as IncomingServerMessage);
        if (!incoming) return;
        reconcileServerMessage(incoming, incoming.clientMessageId);
      }
    };

    ws.onclose = (event) => {
      if (import.meta.env.DEV) {
        console.warn("[chat-ws] closed", { eventId, code: event.code, reason: event.reason || null, wasClean: event.wasClean });
      }
      if (closedByCleanup) return;
      setIsSubscribed(false);
      if (isLockedRef.current) return;
      setConnectionStatus("reconnecting");
      reconnectAttemptRef.current += 1;
      const delay = randomBackoffMs(reconnectAttemptRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        setRetryTick((n) => n + 1);
      }, delay);
    };

    ws.onerror = () => {
      if (import.meta.env.DEV) {
        console.error("[chat-ws] error", { eventId });
      }
      setConnectionStatus("error");
    };

    return () => {
      closedByCleanup = true;
      pendingAckTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      pendingAckTimersRef.current.clear();
      if (reconnectTimerRef.current != null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [applyReactionUpdate, enabled, eventId, markFailed, mergeMessages, queryClient, reconcileServerMessage, retryTick]);

  const sendMessageWithClientId = useCallback(async (
    text: string,
    clientMessageId: string,
    actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null },
  ): Promise<SendMessageResult> => {
    const trimmed = text.trim();
    const ws = wsRef.current;
    const wsReadyState = ws?.readyState ?? -1;
    if (!trimmed) return { ok: false, reason: "empty", wsReadyState, isSubscribed };
    if (!eventId) return { ok: false, reason: "no-eventId", wsReadyState, isSubscribed };
    if (isLocked) return { ok: false, reason: "locked", wsReadyState, isSubscribed };

    if (import.meta.env.DEV && !loggedTransportRef.current) {
      const apiUrl = `${getApiBase()}/api/plans/${eventId}/chat/messages`;
      const wsUrl = getEventChatWsUrl(eventId);
      console.log("[chat-transport]", { apiUrl, wsUrl });
      loggedTransportRef.current = true;
    }

    const optimistic: ChatMessage = {
      id: `optimistic:${clientMessageId}`,
      clientMessageId,
      eventId: String(eventId),
      type: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
      serverCreatedAt: new Date().toISOString(),
      status: "sending",
      optimistic: true,
      user: {
        id: String(actor?.id ?? "me"),
        name: actor?.name ?? "You",
        avatarUrl: actor?.avatarUrl ?? null,
      },
    };
    mergeMessages(optimistic);

    const sendViaSocket = ws && ws.readyState === WebSocket.OPEN && isSubscribed;
    if (sendViaSocket) {
      try {
        const frame = { type: "chat:send", eventId, content: trimmed, clientMessageId };
        if (import.meta.env.DEV) {
          console.log("[chat-ws:out]", {
            eventId,
            frame,
            wsReadyState: ws.readyState,
            isSubscribed,
          });
        }
        ws.send(JSON.stringify(frame));
        const timeoutId = window.setTimeout(() => {
          if (import.meta.env.DEV) {
            console.error("[chat-send:timeout]", {
              eventId,
              clientMessageId,
              reason: "missing chat:ack/chat:new within timeout",
            });
          }
          markFailed(clientMessageId);
          pendingAckTimersRef.current.delete(clientMessageId);
        }, 8000);
        pendingAckTimersRef.current.set(clientMessageId, timeoutId);
        return { ok: true, wsReadyState: ws.readyState, isSubscribed };
      } catch {
        // Fall through to HTTP fallback.
      }
    }

    try {
      await sendViaHttp(clientMessageId, trimmed);
      return { ok: true, wsReadyState, isSubscribed };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[chat-send] fallback-http failed", {
          eventId,
          clientMessageId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      markFailed(clientMessageId);
      return { ok: true, wsReadyState, isSubscribed };
    }
  }, [eventId, isLocked, isSubscribed, markFailed, mergeMessages, sendViaHttp]);

  const sendMessage = useCallback(async (text: string, actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null }): Promise<SendMessageResult> => {
    return sendMessageWithClientId(text, createClientMessageId(), actor);
  }, [sendMessageWithClientId]);

  const retrySend = useCallback(async (clientMessageId: string, actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null }) => {
    const snapshot = messages.find((msg) => msg.clientMessageId === clientMessageId);
    if (!snapshot) return;
    setMessages((prev) => prev.map((msg) => (
      msg.clientMessageId === clientMessageId ? { ...msg, status: "sending", optimistic: true } : msg
    )));
    const result = await sendMessageWithClientId(snapshot.text, clientMessageId, actor);
    if (!result.ok) markFailed(clientMessageId);
  }, [markFailed, messages, sendMessageWithClientId]);

  const sendTyping = useCallback((
    actor?: { id?: string | number | null; name?: string | null },
    typing: boolean = true,
  ) => {
    const ws = wsRef.current;
    if (!eventId || isLocked || !isSubscribed || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({
        type: typing ? "typing:start" : "typing:stop",
        eventId,
        user: {
          id: String(actor?.id ?? "unknown"),
          name: actor?.name ?? "Someone",
        },
      }));
      if (typing) {
        // Backward compatibility for older servers/clients still listening to chat:typing
        ws.send(JSON.stringify({
          type: "typing",
          eventId,
          user: {
            id: String(actor?.id ?? "unknown"),
            name: actor?.name ?? "Someone",
          },
        }));
      }
    } catch {
      // no-op
    }
  }, [eventId, isLocked, isSubscribed]);

  const toggleReaction = useCallback(async (input: {
    messageId: string;
    emoji: string;
    actorId?: string | number | null;
  }) => {
    if (!eventId || !input.messageId || !input.emoji) return;
    const actorId = input.actorId != null ? String(input.actorId) : "";
    setMessages((prev) => prev.map((message) => {
      if (message.id !== input.messageId) return message;
      const current = message.reactions ?? [];
      const existing = current.find((reaction) => reaction.emoji === input.emoji);
      let next: Array<{ emoji: string; count: number; me: boolean }> = [];
      if (!existing) {
        next = [...current, { emoji: input.emoji, count: 1, me: true }];
      } else if (existing.me) {
        next = current
          .map((reaction) => reaction.emoji === input.emoji ? { ...reaction, count: Math.max(0, reaction.count - 1), me: false } : reaction)
          .filter((reaction) => reaction.count > 0);
      } else {
        next = current.map((reaction) => reaction.emoji === input.emoji ? { ...reaction, count: reaction.count + 1, me: true } : reaction);
      }
      return { ...message, reactions: next };
    }));

    const ws = wsRef.current;
    const sendViaSocket = ws && ws.readyState === WebSocket.OPEN && isSubscribed;
    if (sendViaSocket) {
      try {
        ws.send(JSON.stringify({
          type: "reaction:toggle",
          eventId,
          messageId: input.messageId,
          emoji: input.emoji,
          user: actorId ? { id: actorId } : undefined,
        }));
        return;
      } catch {
        // fall through to HTTP
      }
    }
    try {
      const res = await fetch(`/api/plans/${eventId}/chat/messages/${encodeURIComponent(input.messageId)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emoji: input.emoji }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Reaction failed");
      const reactions = Array.isArray((body as any).reactions)
        ? (body as any).reactions
          .map((reaction: any) => {
            const emoji = typeof reaction?.emoji === "string" ? reaction.emoji : "";
            const count = Number(reaction?.count ?? 0);
            if (!emoji || !Number.isFinite(count) || count <= 0) return null;
            return { emoji, count, me: reaction?.me === true };
          })
          .filter((reaction: { emoji: string; count: number; me: boolean } | null): reaction is { emoji: string; count: number; me: boolean } => !!reaction)
        : [];
      applyReactionUpdate(input.messageId, reactions);
    } catch {
      // Server will usually reconcile via ws broadcast; keep optimistic state on failure.
    }
  }, [applyReactionUpdate, eventId, isSubscribed]);

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
    retrySend,
    sendTyping,
    toggleReaction,
    loadOlder,
    retry,
  }), [
    messages,
    historyLoading,
    historyLoadingOlder,
    historyError,
    nextCursor,
    connectionStatus,
    isLocked,
    isSubscribed,
    typingUsers,
    sendMessage,
    retrySend,
    sendTyping,
    toggleReaction,
    loadOlder,
    retry,
  ]);
}
