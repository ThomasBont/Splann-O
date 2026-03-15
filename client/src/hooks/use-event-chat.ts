import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiRequest, type ApiRequestOptions } from "@/lib/api";
import { useEventRealtime, type RealtimeConnectionStatus } from "@/lib/event-realtime";
import { getApiBase } from "@/lib/network";
import { expensesQueryKey, planBalancesQueryKey, planExpensesQueryKey, type RealtimePlanBalances } from "@/hooks/use-expenses";
import { planPhotosQueryKey } from "@/hooks/use-plan-photos";
import { dedupeExpenseSystemMessages } from "@/lib/chat/dedupe-expense-system-messages";
import { filterChatMessages } from "@/lib/chat/filter-chat-messages";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";
import { markPlanSwitchPerf } from "@/lib/plan-switch-perf";

export type ChatMessage = {
  id: string;
  eventId: string;
  clientMessageId?: string;
  type: "user" | "system" | "poll";
  text: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  serverCreatedAt?: string;
  editedAt?: string | null;
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

type OutgoingMessageMetadata = Record<string, unknown> | null | undefined;

type IncomingServerMessage = {
  id: string;
  eventId: string;
  clientMessageId?: string;
  type?: "user" | "system" | "poll";
  text?: string;
  content?: string;
  metadata?: unknown;
  createdAt: string;
  serverCreatedAt?: string;
  editedAt?: string | null;
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
    const res = await apiFetch(url);
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

async function fetchChatMutationWithFallback(
  planId: number,
  messageId: string,
  init: ApiRequestOptions,
) {
  const rawMessageId = messageId.trim();
  const normalizedMessageId = rawMessageId.startsWith("optimistic:")
    ? rawMessageId.slice("optimistic:".length)
    : rawMessageId;
  const candidateIds = Array.from(new Set([rawMessageId, normalizedMessageId].filter(Boolean)));
  const tryRequest = async (url: string) => {
    const res = await apiFetch(url, init);
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

  let result: { res: Response; body: unknown } | null = null;
  for (const id of candidateIds) {
    const encodedMessageId = encodeURIComponent(id);
    result = await tryRequest(`/api/plans/${planId}/chat/messages/${encodedMessageId}`);
    if (result.res.ok || result.res.status !== 404) return result;
    result = await tryRequest(`/api/events/${planId}/chat/messages/${encodedMessageId}`);
    if (result.res.ok || result.res.status !== 404) return result;
  }
  return result ?? tryRequest(`/api/plans/${planId}/chat/messages/${encodeURIComponent(rawMessageId)}`);
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
    type: raw.type === "system" ? "system" : (raw.type === "poll" ? "poll" : "user"),
    text: content,
    metadata: (raw.metadata && typeof raw.metadata === "object") ? (raw.metadata as Record<string, unknown>) : null,
    createdAt,
    serverCreatedAt: raw.serverCreatedAt ?? createdAt,
    editedAt: typeof raw.editedAt === "string" ? raw.editedAt : null,
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

export function useEventChat(eventId: number | null, enabled = true) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingOlder, setHistoryLoadingOlder] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isLocked, setIsLocked] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const isLockedRef = useRef(false);
  const loggedTransportRef = useRef(false);
  const pendingAckTimersRef = useRef(new Map<string, number>());
  const typingExpiryTimersRef = useRef(new Map<string, number>());
  const lastConnectedVersionRef = useRef(0);

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

  const refreshPaymentViews = useCallback(async (planId: number) => {
    if (!Number.isFinite(planId) || planId <= 0) return;
    if (import.meta.env.DEV) {
      console.log("[settle-now:refresh]", { planId });
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: expensesQueryKey(planId) }),
      queryClient.invalidateQueries({ queryKey: planExpensesQueryKey(planId) }),
      queryClient.invalidateQueries({ queryKey: ["/api/events", planId, "settlements"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/events", planId, "settlement"] }),
      queryClient.invalidateQueries({ queryKey: planMessagesQueryKey(planId) }),
    ]);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: expensesQueryKey(planId) }),
      queryClient.refetchQueries({ queryKey: planExpensesQueryKey(planId) }),
      queryClient.refetchQueries({ queryKey: ["/api/events", planId, "settlements"] }),
      queryClient.refetchQueries({ queryKey: ["/api/events", planId, "settlement"] }),
    ]);
  }, [queryClient]);

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

  const applyMessageUpdate = useCallback((message: ChatMessage) => {
    setMessages((prev) => dedupeAndSort(prev.map((current) => (
      current.id === message.id ? { ...current, ...message, status: "sent", optimistic: false } : current
    ))));
  }, []);

  const applyMessageDelete = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  }, []);

  const realtime = useEventRealtime(eventId, enabled, (rawPayload) => {
    const payload = rawPayload as any;
    if (payload?.type === "event:chat_locked" || (payload?.type === "event:error" && payload.code === "CHAT_LOCKED")) {
      setIsLocked(true);
      isLockedRef.current = true;
      setConnectionStatus("locked");
      return;
    }
    if (payload?.type === "chat:system" && payload.text) {
      mergeMessages({
        id: `system-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        eventId: String(payload.eventId ?? eventId ?? ""),
        type: "system",
        text: payload.text,
        createdAt: new Date().toISOString(),
        serverCreatedAt: new Date().toISOString(),
        status: "sent",
        optimistic: false,
      });
      return;
    }
    if (((payload?.type === "chat:typing") || payload?.type === "typing" || payload?.type === "chat:typing_start" || payload?.type === "typing:start") && payload.user?.id) {
      const nextUser = { id: String(payload.user.id), name: payload.user.name || "Someone" };
      setTypingUsers((prev) => [...prev.filter((u) => u.id !== nextUser.id), nextUser]);
      const existingTimer = typingExpiryTimersRef.current.get(nextUser.id);
      if (existingTimer != null) window.clearTimeout(existingTimer);
      const timer = window.setTimeout(() => {
        typingExpiryTimersRef.current.delete(nextUser.id);
        setTypingUsers((prev) => prev.filter((u) => u.id !== nextUser.id));
      }, 3000);
      typingExpiryTimersRef.current.set(nextUser.id, timer);
      return;
    }
    if ((payload?.type === "chat:typing_stop" || payload?.type === "typing:stop") && payload.user?.id) {
      const targetId = String(payload.user.id);
      const existingTimer = typingExpiryTimersRef.current.get(targetId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
        typingExpiryTimersRef.current.delete(targetId);
      }
      setTypingUsers((prev) => prev.filter((u) => u.id !== targetId));
      return;
    }
    if (payload?.type === "chat:error") {
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
    if (payload?.type === "chat:update") {
      const incoming = normalizeIncomingMessage(payload.message as IncomingServerMessage);
      if (incoming) applyMessageUpdate(incoming);
      return;
    }
    if (payload?.type === "chat:delete" && typeof payload.messageId === "string") {
      applyMessageDelete(payload.messageId);
      return;
    }
    if (payload?.type === "plan:balancesUpdated") {
      const planId = Number(payload.planId);
      if (!Number.isFinite(planId) || planId !== eventId) return;
      queryClient.setQueryData(planBalancesQueryKey(planId), {
        type: "plan:balancesUpdated",
        planId,
        balances: Array.isArray(payload.balances) ? payload.balances : [],
        suggestedPaybacks: Array.isArray(payload.suggestedPaybacks) ? payload.suggestedPaybacks : [],
        updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
        version: typeof payload.version === "number" ? payload.version : Date.now(),
      } satisfies RealtimePlanBalances);
      return;
    }
    if (payload?.type === "settlement:started" || payload?.type === "settlement:completed" || payload?.type === "settlement_payment") {
      const planId = Number(payload.eventId ?? eventId);
      if (!Number.isFinite(planId) || planId !== eventId) return;
      void refreshPaymentViews(planId);
      return;
    }
    if (payload?.type === "photos:updated") {
      const planId = Number(payload.eventId ?? eventId);
      if (!Number.isFinite(planId) || planId !== eventId) return;
      void queryClient.invalidateQueries({ queryKey: planPhotosQueryKey(planId) });
      return;
    }
    if (payload?.type === "chat:ack") {
      const incoming = normalizeIncomingMessage(payload.message as IncomingServerMessage);
      if (incoming) reconcileServerMessage(incoming, typeof payload.clientMessageId === "string" ? payload.clientMessageId : incoming.clientMessageId);
      return;
    }
    if (payload?.type === "chat:new") {
      const incoming = normalizeIncomingMessage(payload.message as IncomingServerMessage);
      if (incoming) reconcileServerMessage(incoming, incoming.clientMessageId);
    }
  });

  const fetchHistoryPage = useCallback(async (before?: string | null) => {
    if (!eventId || !enabled) return { messages: [] as ChatMessage[], nextCursor: null as string | null, locked: false };
    const page = await fetchPlanMessages(eventId, before);
    return page;
  }, [enabled, eventId]);

  useEffect(() => {
    setMessages([]);
    setNextCursor(null);
    setHistoryError(null);
    setHistoryLoading(!!eventId && enabled);
    setHistoryLoadingOlder(false);
    setTypingUsers([]);
    setIsSubscribed(false);
    setIsLocked(false);
    setConnectionStatus(eventId && enabled ? "connecting" : "idle");
    typingExpiryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    typingExpiryTimersRef.current.clear();
    pendingAckTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    pendingAckTimersRef.current.clear();
    isLockedRef.current = false;
    lastConnectedVersionRef.current = 0;
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

  const sendViaHttp = useCallback(async (clientMessageId: string, text: string, metadata?: OutgoingMessageMetadata) => {
    if (!eventId) throw new Error("No event id");
    const endpoint = `/api/plans/${eventId}/chat/messages`;
    try {
      const body = await apiRequest<{ message?: IncomingServerMessage }>(endpoint, {
        method: "POST",
        body: { content: text, clientMessageId, metadata: metadata ?? null },
      });
      const raw = body.message;
      const normalized = raw ? normalizeIncomingMessage(raw) : null;
      if (!normalized) throw new Error("Invalid message response");
      reconcileServerMessage(normalized, clientMessageId);
    } catch (error) {
      const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : null;
      const code = typeof error === "object" && error !== null && "data" in error && typeof (error as { data?: unknown }).data === "object"
        ? ((error as { data?: { code?: string } }).data?.code ?? null)
        : null;
      if (status === 403 && code === "CHAT_LOCKED") {
        setIsLocked(true);
        isLockedRef.current = true;
        setConnectionStatus("locked");
      }
      throw new Error(error instanceof Error ? error.message : "Failed to send message");
    }
  }, [eventId, reconcileServerMessage]);

  useEffect(() => {
    void fetchInitialHistory();
  }, [fetchInitialHistory]);

  useEffect(() => {
    if (!import.meta.env.DEV || !eventId || historyLoading || historyError) return;
    markPlanSwitchPerf(eventId, "messages ready", { count: messages.length });
  }, [eventId, historyError, historyLoading, messages.length]);

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
      setIsSubscribed(false);
      return;
    }
    setIsSubscribed(realtime.isSubscribed);
    if (!isLockedRef.current) {
      setConnectionStatus(realtime.status === "offline" ? "disconnected" : realtime.status);
    }
  }, [enabled, eventId, realtime.isSubscribed, realtime.status]);

  useEffect(() => {
    if (!enabled || !eventId || realtime.connectedVersion <= 0) return;
    if (lastConnectedVersionRef.current === 0) {
      lastConnectedVersionRef.current = realtime.connectedVersion;
      return;
    }
    if (realtime.connectedVersion !== lastConnectedVersionRef.current) {
      lastConnectedVersionRef.current = realtime.connectedVersion;
      void fetchInitialHistory();
      void refreshPaymentViews(eventId);
    }
  }, [enabled, eventId, fetchInitialHistory, realtime.connectedVersion, refreshPaymentViews]);

  useEffect(() => {
    if (!enabled || !eventId) return;
    const onExternalMessage = (rawEvent: Event) => {
      const event = rawEvent as CustomEvent<{ eventId?: number; message?: IncomingServerMessage }>;
      const nextEventId = Number(event.detail?.eventId ?? 0);
      if (!Number.isFinite(nextEventId) || nextEventId !== eventId) return;
      const normalized = event.detail?.message ? normalizeIncomingMessage(event.detail.message) : null;
      if (!normalized) return;
      reconcileServerMessage(normalized, normalized.clientMessageId);
    };
    window.addEventListener("splanno:chat-message-created", onExternalMessage as EventListener);
    return () => {
      window.removeEventListener("splanno:chat-message-created", onExternalMessage as EventListener);
    };
  }, [enabled, eventId, reconcileServerMessage]);

  const sendMessageWithClientId = useCallback(async (
    text: string,
    clientMessageId: string,
    actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null },
    metadata?: OutgoingMessageMetadata,
  ): Promise<SendMessageResult> => {
    const trimmed = text.trim();
    const wsReadyState = realtime.readyState ?? -1;
    if (!trimmed) return { ok: false, reason: "empty", wsReadyState, isSubscribed };
    if (!eventId) return { ok: false, reason: "no-eventId", wsReadyState, isSubscribed };
    if (isLocked) return { ok: false, reason: "locked", wsReadyState, isSubscribed };

    if (import.meta.env.DEV && !loggedTransportRef.current) {
      const apiUrl = `${getApiBase()}/api/plans/${eventId}/chat/messages`;
      const wsUrl = typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/events/${eventId}/chat`
        : "";
      console.log("[chat-transport]", { apiUrl, wsUrl });
      loggedTransportRef.current = true;
    }

    const optimistic: ChatMessage = {
      id: `optimistic:${clientMessageId}`,
      clientMessageId,
      eventId: String(eventId),
      type: "user",
      text: trimmed,
      metadata: metadata ?? null,
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

    const sendViaSocket = realtime.send({ type: "chat:send", eventId, content: trimmed, clientMessageId, metadata: metadata ?? null });
    if (sendViaSocket) {
      try {
        if (import.meta.env.DEV) {
          console.log("[chat-ws:out]", {
            eventId,
            clientMessageId,
            wsReadyState,
            isSubscribed,
          });
        }
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
        return { ok: true, wsReadyState, isSubscribed };
      } catch {
        // Fall through to HTTP fallback.
      }
    }

    try {
      await sendViaHttp(clientMessageId, trimmed, metadata);
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
  }, [eventId, isLocked, isSubscribed, markFailed, mergeMessages, realtime, sendViaHttp]);

  const sendMessage = useCallback(async (
    text: string,
    actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null },
    metadata?: OutgoingMessageMetadata,
  ): Promise<SendMessageResult> => {
    return sendMessageWithClientId(text, createClientMessageId(), actor, metadata);
  }, [sendMessageWithClientId]);

  const retrySend = useCallback(async (clientMessageId: string, actor?: { id?: string | number | null; name?: string | null; avatarUrl?: string | null }) => {
    const snapshot = messages.find((msg) => msg.clientMessageId === clientMessageId);
    if (!snapshot) return;
    setMessages((prev) => prev.map((msg) => (
      msg.clientMessageId === clientMessageId ? { ...msg, status: "sending", optimistic: true } : msg
    )));
    const result = await sendMessageWithClientId(snapshot.text, clientMessageId, actor, snapshot.metadata);
    if (!result.ok) markFailed(clientMessageId);
  }, [markFailed, messages, sendMessageWithClientId]);

  const sendTyping = useCallback((
    actor?: { id?: string | number | null; name?: string | null },
    typing: boolean = true,
  ) => {
    if (!eventId || isLocked || !isSubscribed) return;
    try {
      const sent = realtime.send({
        type: typing ? "typing:start" : "typing:stop",
        eventId,
        user: {
          id: String(actor?.id ?? "unknown"),
          name: actor?.name ?? "Someone",
        },
      });
      if (!sent) return;
      if (typing) {
        realtime.send({
          type: "typing",
          eventId,
          user: {
            id: String(actor?.id ?? "unknown"),
            name: actor?.name ?? "Someone",
          },
        });
      }
    } catch {
      // no-op
    }
  }, [eventId, isLocked, isSubscribed, realtime]);

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

    const sendViaSocket = realtime.send({
      type: "reaction:toggle",
      eventId,
      messageId: input.messageId,
      emoji: input.emoji,
      user: actorId ? { id: actorId } : undefined,
    });
    if (sendViaSocket) {
      try {
        return;
      } catch {
        // fall through to HTTP
      }
    }
    try {
      const body = await apiRequest<{ reactions?: Array<{ emoji?: string; count?: number; me?: boolean }> }>(`/api/plans/${eventId}/chat/messages/${encodeURIComponent(input.messageId)}/reactions`, {
        method: "POST",
        body: { emoji: input.emoji },
      });
      const reactions = Array.isArray(body.reactions)
        ? body.reactions
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
  }, [applyReactionUpdate, eventId, isSubscribed, realtime]);

  const retry = useCallback(() => {
    realtime.reconnectNow();
    void fetchInitialHistory();
  }, [fetchInitialHistory, realtime]);

  const refreshHistory = useCallback(async () => {
    await fetchInitialHistory();
  }, [fetchInitialHistory]);

  const editMessage = useCallback(async (messageId: string, content: string) => {
    if (!eventId) throw new Error("Plan not loaded yet.");
    const trimmed = content.trim();
    if (!trimmed) throw new Error("Message cannot be empty.");
    const { res, body } = await fetchChatMutationWithFallback(eventId, messageId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: trimmed }),
    });
    if (!res.ok) throw new Error((body as { message?: string }).message || "Couldn’t edit message.");
    const incoming = normalizeIncomingMessage((body as { message?: IncomingServerMessage }).message as IncomingServerMessage);
    if (!incoming) throw new Error("Invalid message response");
    applyMessageUpdate(incoming);
  }, [applyMessageUpdate, eventId]);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!eventId) throw new Error("Plan not loaded yet.");
    const { res, body } = await fetchChatMutationWithFallback(eventId, messageId, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error((body as { message?: string }).message || "Couldn’t delete message.");
    applyMessageDelete(messageId);
  }, [applyMessageDelete, eventId]);

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
    wsReadyState: realtime.readyState ?? -1,
    sendMessage,
    retrySend,
    sendTyping,
    toggleReaction,
    editMessage,
    deleteMessage,
    loadOlder,
    retry,
    refreshHistory,
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
    editMessage,
    deleteMessage,
    loadOlder,
    retry,
    refreshHistory,
    realtime.readyState,
  ]);
}
