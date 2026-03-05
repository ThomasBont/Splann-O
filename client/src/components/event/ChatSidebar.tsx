import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CreditCard, Loader2, MapPin, MessageCircle, Paperclip, SendHorizontal, Smile, Users } from "lucide-react";
import { InlineQueryError, SkeletonLine } from "@/components/ui/load-states";
import { useEventChat } from "@/hooks/use-event-chat";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventMembers } from "@/hooks/use-participants";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { cn } from "@/lib/utils";
import type { SendMessageResult } from "@/hooks/use-event-chat";
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from "@shared/lib/system-user";
import { ExpenseCard, type ExpenseMessageMetadata } from "@/components/event/chat/ExpenseCard";
import { SettlementCard } from "@/components/event/chat/SettlementCard";

type ChatSidebarProps = {
  eventId: number | null;
  eventName?: string | null;
  location?: string | null;
  dateTime?: Date | string | null;
  participantCount?: number;
  sharedTotal?: number;
  currency?: string;
  onSummaryClick?: () => void;
  currentUser?: { id?: number | null; username?: string | null; avatarUrl?: string | null } | null;
  enabled?: boolean;
  className?: string;
};

const GROUP_WINDOW_MS = 10 * 60 * 1000;
const QUICK_EMOJIS = ["😀", "😂", "😍", "🙏", "🔥", "🎉", "👍", "❤️"];

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateSeparator(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (isSameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  const safe = name.trim();
  if (!safe) return "U";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return safe.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function getMessageSenderKey(message: { type?: string; user?: { id?: string | null; name?: string | null } }): string | null {
  if (message.type === "user") {
    const id = String(message.user?.id ?? "").trim();
    if (id) return `user:id:${id}`;
    const name = String(message.user?.name ?? "").trim().toLowerCase();
    if (name) return `user:name:${name}`;
    return null;
  }
  if (message.type === "system") {
    const id = String(message.user?.id ?? SYSTEM_USER_ID).trim();
    if (id) return `system:id:${id}`;
    const name = String(message.user?.name ?? SYSTEM_USER_NAME).trim().toLowerCase();
    return name ? `system:name:${name}` : "system:unknown";
  }
  return null;
}

function toExpenseMetadata(input: Record<string, unknown> | null | undefined): ExpenseMessageMetadata | null {
  if (!input || input.type !== "expense") return null;
  const action = input.action;
  if (action !== "added" && action !== "updated" && action !== "deleted") return null;
  const expenseIdRaw = input.expenseId;
  const expenseId = typeof expenseIdRaw === "number" ? expenseIdRaw : Number(expenseIdRaw);
  if (!Number.isFinite(expenseId)) return null;
  const item = typeof input.item === "string" ? input.item : String(input.item ?? "").trim();
  const amountRaw = input.amount;
  const amount = typeof amountRaw === "number" ? amountRaw : Number(amountRaw);
  const currency = typeof input.currency === "string" ? input.currency : String(input.currency ?? "").trim();
  const paidBy = typeof input.paidBy === "string" ? input.paidBy : String(input.paidBy ?? "").trim();
  return {
    action,
    expenseId,
    item: item || "Expense",
    amount: Number.isFinite(amount) ? amount : 0,
    currency: currency || "€",
    paidBy: paidBy || "Someone",
  };
}

type SettlementMetadata = {
  type: "settlement";
  settlementId: string;
  action: "proposed" | "updated" | "settled";
  currency: string;
};

type SettlementPaymentMetadata = {
  type: "settlement_payment";
  settlementId: string;
  transferId: string;
  fromUserId: number;
  toUserId: number;
  amount: number;
  currency: string;
  status: "paid";
};

function toSettlementMetadata(input: Record<string, unknown> | null | undefined): SettlementMetadata | null {
  if (!input || input.type !== "settlement") return null;
  const settlementId = String(input.settlementId ?? "").trim();
  if (!settlementId) return null;
  const action = input.action;
  if (action !== "proposed" && action !== "updated" && action !== "settled") return null;
  const currency = String(input.currency ?? "").trim() || "EUR";
  return {
    type: "settlement",
    settlementId,
    action,
    currency,
  };
}

type SettlementCacheResponse = {
  settlement: {
    id: string;
    eventId: number;
    status: "proposed" | "in_progress" | "settled";
    source: "auto" | "manual";
    currency: string | null;
    createdAt: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    fromUserId: number;
    fromName?: string;
    toUserId: number;
    toName?: string;
    amountCents: number;
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
    paymentRef: string | null;
  }>;
};

function toSettlementPaymentMetadata(input: Record<string, unknown> | null | undefined): SettlementPaymentMetadata | null {
  if (!input || input.type !== "settlement_payment") return null;
  const settlementId = String(input.settlementId ?? "").trim();
  const transferId = String(input.transferId ?? "").trim();
  const fromUserId = Number(input.fromUserId);
  const toUserId = Number(input.toUserId);
  const amount = Number(input.amount);
  const currency = String(input.currency ?? "").trim() || "EUR";
  const status = input.status;
  if (!settlementId || !transferId || !Number.isFinite(fromUserId) || !Number.isFinite(toUserId) || !Number.isFinite(amount)) return null;
  if (status !== "paid") return null;
  return {
    type: "settlement_payment",
    settlementId,
    transferId,
    fromUserId,
    toUserId,
    amount,
    currency,
    status,
  };
}

function formatMoneyForSystem(amount: number, currencyCode: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currencyCode || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
    } catch {
      // fallthrough
    }
  }
  return `${currencyCode || "€"}${safeAmount.toFixed(2)}`;
}

function formatHeaderDate(value: Date | string | null | undefined): string {
  if (!value) return "Date TBA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBA";
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} · ${time}`;
}

function isGroupedWithNeighbor(
  current: { type?: string; createdAt: string; user?: { id?: string | null; name?: string | null } },
  neighbor?: { type?: string; createdAt: string; user?: { id?: string | null; name?: string | null } },
): boolean {
  if (!neighbor) return false;
  if (current.type !== neighbor.type) return false;
  const currentKey = getMessageSenderKey(current);
  const neighborKey = getMessageSenderKey(neighbor);
  if (!currentKey || !neighborKey || currentKey !== neighborKey) return false;
  const currentTime = new Date(current.createdAt).getTime();
  const neighborTime = new Date(neighbor.createdAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(neighborTime)) return false;
  return Math.abs(currentTime - neighborTime) < GROUP_WINDOW_MS;
}

export function ChatSidebar({
  eventId,
  eventName,
  location = null,
  dateTime = null,
  participantCount = 0,
  sharedTotal = 0,
  currency = "EUR",
  onSummaryClick,
  currentUser,
  enabled = true,
  className,
}: ChatSidebarProps) {
  const { toastError, toastInfo } = useAppToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingEmitTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [optimisticallyDeletedExpenseIds, setOptimisticallyDeletedExpenseIds] = useState<number[]>([]);
  const {
    messages,
    historyLoading,
    historyLoadingOlder,
    hasMoreHistory,
    historyError,
    connectionStatus,
    isLocked,
    isSubscribed,
    typingUsers,
    wsReadyState,
    sendMessage,
    retrySend,
    sendTyping,
    toggleReaction,
    loadOlder,
    retry,
  } = useEventChat(eventId, enabled && !!eventId);
  const deleteExpense = useDeleteExpense(eventId);
  const membersQuery = useEventMembers(eventId);
  const membersById = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string | null; username?: string | null }>();
    for (const member of membersQuery.data ?? []) {
      map.set(String(member.userId), {
        name: member.name || member.username || "Unknown user",
        avatarUrl: member.avatarUrl ?? null,
        username: member.username ?? null,
      });
    }
    return map;
  }, [membersQuery.data]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!isNearBottom) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isNearBottom]);

  useEffect(() => {
    return () => {
      if (typingEmitTimerRef.current != null) {
        window.clearTimeout(typingEmitTimerRef.current);
        typingEmitTimerRef.current = null;
      }
      if (typingStopTimerRef.current != null) {
        window.clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
    };
  }, []);

  const emitTypingStart = useCallback(() => {
    if (!eventId || isLocked) return;
    sendTyping({
      id: currentUser?.id ?? null,
      name: currentUser?.username ?? "Someone",
    }, true);
  }, [currentUser?.id, currentUser?.username, eventId, isLocked, sendTyping]);

  const emitTypingStop = useCallback(() => {
    if (!eventId) return;
    sendTyping({
      id: currentUser?.id ?? null,
      name: currentUser?.username ?? "Someone",
    }, false);
  }, [currentUser?.id, currentUser?.username, eventId, sendTyping]);

  const scheduleTypingSignals = useCallback(() => {
    if (typingEmitTimerRef.current != null) {
      window.clearTimeout(typingEmitTimerRef.current);
    }
    typingEmitTimerRef.current = window.setTimeout(() => {
      emitTypingStart();
      typingEmitTimerRef.current = null;
    }, 220);

    if (typingStopTimerRef.current != null) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      emitTypingStop();
      typingStopTimerRef.current = null;
    }, 1000);
  }, [emitTypingStart, emitTypingStop]);

  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (!value.trim()) {
      if (typingEmitTimerRef.current != null) {
        window.clearTimeout(typingEmitTimerRef.current);
        typingEmitTimerRef.current = null;
      }
      if (typingStopTimerRef.current != null) {
        window.clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      emitTypingStop();
      return;
    }
    scheduleTypingSignals();
  }, [emitTypingStop, scheduleTypingSignals]);

  const liveLabel = useMemo(() => {
    if (isLocked) return { text: "Locked", cls: "bg-rose-500" };
    if (connectionStatus === "connected") return { text: "Live", cls: "bg-emerald-500" };
    if (connectionStatus === "reconnecting" || connectionStatus === "connecting") return { text: "Reconnecting…", cls: "bg-amber-500" };
    return { text: "Offline", cls: "bg-muted-foreground/70" };
  }, [connectionStatus, isLocked]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (import.meta.env.DEV) {
      console.log("[chat-send]", { textLen: text.length, isLocked, eventId, transport: "ws", wsState: wsReadyState, isSubscribed, sending });
    }
    if (sending) return;

    if (!text) {
      if (import.meta.env.DEV) console.log("[chat-send] blocked: empty");
      return;
    }
    if (isLocked) {
      if (import.meta.env.DEV) console.log("[chat-send] blocked: locked");
      toastError("Plan chat is locked.");
      return;
    }
    if (!eventId) {
      if (import.meta.env.DEV) console.log("[chat-send] blocked: no-eventId");
      toastError("Plan not loaded yet.");
      return;
    }

    setSending(true);
    let result: SendMessageResult;
    try {
      result = await sendMessage(text, {
        id: currentUser?.id ?? null,
        name: currentUser?.username ?? "You",
        avatarUrl: currentUser?.avatarUrl ?? null,
      });
    } catch (error) {
      setSending(false);
      const message = error instanceof Error ? error.message : "Unknown error";
      toastError(`Couldn’t send message (${message}). Try again.`);
      return;
    }
    setSending(false);
    if (!result.ok) {
      if (import.meta.env.DEV) {
        console.log(`[chat-send] blocked: ${result.reason ?? "unknown"}`, {
          eventId,
          wsReadyState: result.wsReadyState,
          isSubscribed: result.isSubscribed,
        });
      }
      if (result.reason === "no-eventId") toastInfo("Plan is still loading.");
      if (result.reason === "locked") toastInfo("Chat is locked.");
      toastError(`Couldn’t send message (${result.reason ?? "unknown"}). Try again.`);
      return;
    }
    emitTypingStop();
    setDraft("");
  };

  const debugFocusBlock = useCallback(() => {
    if (!import.meta.env.DEV) return;
    window.setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      if (document.activeElement === input) return;
      const inputStyle = window.getComputedStyle(input);
      const parent = input.parentElement;
      const parentStyle = parent ? window.getComputedStyle(parent) : null;
      const overlay = document.querySelector("[data-radix-dialog-overlay]");
      console.warn("[chat-focus-debug]", {
        eventId,
        inputPointerEvents: inputStyle.pointerEvents,
        inputOpacity: inputStyle.opacity,
        parentPointerEvents: parentStyle?.pointerEvents,
        overlayPresent: !!overlay,
      });
    }, 0);
  }, [eventId]);

  const visibleTypingUsers = useMemo(() => {
    const meId = String(currentUser?.id ?? "");
    return typingUsers.filter((user) => String(user.id) !== meId);
  }, [currentUser?.id, typingUsers]);

  const groupedMessages = useMemo(() => {
    const groups: Array<
      | { kind: "expense-cluster"; messages: typeof messages }
      | { kind: "single"; message: (typeof messages)[number] }
    > = [];

    let index = 0;
    while (index < messages.length) {
      const current = messages[index];
      const currentMeta = current?.type === "system" ? toExpenseMetadata(current.metadata ?? null) : null;
      if (!currentMeta) {
        groups.push({ kind: "single", message: current });
        index += 1;
        continue;
      }

      const cluster: typeof messages = [current];
      let cursor = index + 1;
      while (cursor < messages.length) {
        const next = messages[cursor];
        const nextMeta = next?.type === "system" ? toExpenseMetadata(next.metadata ?? null) : null;
        if (!nextMeta) break;
        cluster.push(next);
        cursor += 1;
      }

      if (cluster.length > 1) {
        groups.push({ kind: "expense-cluster", messages: cluster });
      } else {
        groups.push({ kind: "single", message: current });
      }
      index = cursor;
    }

    return groups;
  }, [messages]);

  const openExpenseEditor = useCallback((expenseId: number) => {
    if (!eventId) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expense", {
      detail: { eventId, expenseId },
    }));
  }, [eventId]);

  const handleDeleteExpenseFromCard = useCallback(async (expenseId: number) => {
    if (!eventId) return;
    setOptimisticallyDeletedExpenseIds((prev) => (prev.includes(expenseId) ? prev : [...prev, expenseId]));
    queryClient.setQueryData(['/api/barbecues', eventId, 'expenses'], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.filter((item) => Number((item as { id?: number }).id) !== expenseId);
    });
    try {
      await deleteExpense.mutateAsync(expenseId);
    } catch (error) {
      setOptimisticallyDeletedExpenseIds((prev) => prev.filter((id) => id !== expenseId));
      await queryClient.invalidateQueries({ queryKey: ['/api/barbecues', eventId, 'expenses'] });
      toastError(error instanceof Error ? error.message : "Couldn’t delete expense. Try again.");
    }
  }, [deleteExpense, eventId, queryClient, toastError]);

  const handleCopyAmount = useCallback(async ({ amount, currency }: { amount: number; currency: string }) => {
    const text = `${currency || "€"}${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  }, []);

  const locationLabel = (location || "").trim() || "Nowhere yet";
  const peopleLabel = `${participantCount} ${participantCount === 1 ? "person" : "people"}`;
  const dateLabel = formatHeaderDate(dateTime);
  const sharedLabel = `${formatMoneyForSystem(sharedTotal, currency)} shared`;

  return (
    <aside
      className={cn("pointer-events-auto flex h-full min-h-0 flex-col overflow-hidden bg-background", className)}
      style={
        {
          "--chat-bg":
            "radial-gradient(1250px 760px at 10% 4%, hsl(var(--muted)/0.1), transparent 68%), radial-gradient(960px 560px at 86% 90%, hsl(var(--primary)/0.03), transparent 70%), hsl(var(--background))",
        } as CSSProperties
      }
    >
      <header className="shrink-0 border-b border-border/70 bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Plan chat</span>
            <span>·</span>
            <span className="truncate">{eventName ? `${eventName} room` : "Plan room"}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-1 text-[10px] text-muted-foreground">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${liveLabel.cls}`} />
            {liveLabel.text}
          </div>
        </div>
        <div
          className={cn(
            "mt-2 flex w-full flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground",
            onSummaryClick ? "cursor-pointer" : "",
          )}
          onClick={onSummaryClick}
          role={onSummaryClick ? "button" : undefined}
          tabIndex={onSummaryClick ? 0 : undefined}
          onKeyDown={onSummaryClick
            ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSummaryClick();
              }
            }
            : undefined}
        >
          <span className="inline-flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{locationLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>{peopleLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{dateLabel}</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>{sharedLabel}</span>
          </span>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--chat-bg)]"
        onScroll={(e) => {
          const el = e.currentTarget;
          const delta = el.scrollHeight - (el.scrollTop + el.clientHeight);
          setIsNearBottom(delta < 64);
        }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col justify-end gap-2 px-4 py-4 sm:px-8 sm:py-6">
        {hasMoreHistory ? (
          <div className="flex justify-center pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-3 text-xs text-muted-foreground"
              onClick={() => void loadOlder()}
              disabled={historyLoadingOlder}
            >
              {historyLoadingOlder ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load older messages"}
            </Button>
          </div>
        ) : null}
        {historyLoading ? (
          <div className="space-y-3">
            <SkeletonLine className="h-10 w-3/4 rounded-xl" />
            <SkeletonLine className="h-10 w-2/3 rounded-xl ml-auto" />
            <SkeletonLine className="h-10 w-4/5 rounded-xl" />
          </div>
        ) : historyError ? (
          <InlineQueryError message="Messages unavailable." onRetry={retry} />
        ) : messages.length === 0 ? (
          <div className="h-full min-h-[180px] flex items-center justify-center text-center px-4">
            <div className="space-y-1 text-muted-foreground">
              <MessageCircle className="h-4 w-4 mx-auto" />
              <p className="text-sm">No messages yet.</p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group, groupIndex) => {
            const currentMsg = group.kind === "expense-cluster" ? group.messages[0] : group.message;
            const previousGroup = groupIndex > 0 ? groupedMessages[groupIndex - 1] : undefined;
            const previousMsg = previousGroup
              ? (previousGroup.kind === "expense-cluster"
                ? previousGroup.messages[previousGroup.messages.length - 1]
                : previousGroup.message)
              : undefined;
            const currentDate = new Date(currentMsg.createdAt);
            const prevDate = previousMsg ? new Date(previousMsg.createdAt) : null;
            const showDateSeparator = !prevDate
              || Number.isNaN(prevDate.getTime())
              || Number.isNaN(currentDate.getTime())
              || !isSameDay(currentDate, prevDate);

            if (group.kind === "expense-cluster") {
              const first = group.messages[0];
              const systemName = first.user?.name || SYSTEM_USER_NAME;
              const metas = group.messages
                .map((message) => toExpenseMetadata(message.metadata ?? null))
                .filter((meta): meta is ExpenseMessageMetadata => !!meta);
              const allAdded = metas.length > 0 && metas.every((meta) => meta.action === "added");
              const clusterSummary = allAdded
                ? `${group.messages.length} expenses added`
                : `${group.messages.length} expense updates`;

              return (
                <div key={`expense-cluster-${first.id}`}>
                  {showDateSeparator ? (
                    <div className="my-2 flex justify-center">
                      <span className="self-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                        {formatDateSeparator(first.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <div className="mt-2 flex justify-start">
                    <div className="mr-2 flex w-10 flex-col items-center pt-0.5">
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-border/70 bg-muted text-[11px] font-semibold text-muted-foreground">
                        S
                      </span>
                    </div>
                    <div className="max-w-[84%] sm:max-w-[78%]">
                      <div className="mb-1 px-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground/90">{systemName}</span>
                        <span className="ml-1 rounded-full border border-border/60 bg-card/60 px-1.5 py-0 text-[9px] uppercase tracking-wide">System</span>
                        <span className="px-1 text-muted-foreground/70">·</span>
                        <span className="text-[10px] text-muted-foreground/70">{formatMessageTime(first.createdAt)}</span>
                      </div>
                      <p className="mb-1 px-1 text-[10px] text-muted-foreground/75">{clusterSummary}</p>
                      <div className="space-y-1">
                        {group.messages.map((message) => {
                          const expenseMeta = toExpenseMetadata(message.metadata ?? null);
                          if (!expenseMeta) return null;
                          return (
                            <ExpenseCard
                              key={message.id}
                              eventId={Number(message.eventId || eventId || 0)}
                              expenseId={expenseMeta.expenseId}
                              action={expenseMeta.action}
                              fallback={{
                                item: expenseMeta.item,
                                amount: expenseMeta.amount,
                                currency: expenseMeta.currency,
                                paidBy: expenseMeta.paidBy,
                              }}
                              optimisticDeleted={optimisticallyDeletedExpenseIds.includes(expenseMeta.expenseId)}
                              onOpenEdit={openExpenseEditor}
                              onDelete={(expenseId) => { void handleDeleteExpenseFromCard(expenseId); }}
                              onCopyAmount={handleCopyAmount}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const msg = group.message;
            if (msg.type === "system") {
              const systemName = msg.user?.name || SYSTEM_USER_NAME;
              const expenseMeta = toExpenseMetadata(msg.metadata ?? null);
              const settlementMeta = toSettlementMetadata(msg.metadata ?? null);
              const settlementPaymentMeta = toSettlementPaymentMetadata(msg.metadata ?? null);
              const settlementCache = settlementPaymentMeta
                ? queryClient.getQueryData<SettlementCacheResponse>([
                  "/api/events",
                  Number(msg.eventId || eventId || 0),
                  "settlement",
                  settlementPaymentMeta.settlementId,
                ])
                : null;
              const paymentTransfer = settlementPaymentMeta
                ? settlementCache?.transfers?.find((transfer) => transfer.id === settlementPaymentMeta.transferId)
                : null;
              const fromName = paymentTransfer?.fromName
                || (settlementPaymentMeta
                  ? membersById.get(String(settlementPaymentMeta.fromUserId))?.name
                  : null)
                || null;
              const toName = paymentTransfer?.toName
                || (settlementPaymentMeta
                  ? membersById.get(String(settlementPaymentMeta.toUserId))?.name
                  : null)
                || null;
              const paymentAmount = settlementPaymentMeta
                ? formatMoneyForSystem(
                  paymentTransfer?.amount ?? settlementPaymentMeta.amount,
                  paymentTransfer?.currency ?? settlementPaymentMeta.currency,
                )
                : null;
              const groupedWithPrev = isGroupedWithNeighbor(msg, previousMsg);
              return (
                <div key={msg.id}>
                  {showDateSeparator ? (
                    <div className="my-2 flex justify-center">
                      <span className="self-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                        {formatDateSeparator(msg.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <div className={`flex justify-start ${groupedWithPrev ? "mt-1" : "mt-2"}`}>
                    <div className="mr-2 flex w-10 flex-col items-center pt-0.5">
                      {!groupedWithPrev ? (
                        <span className="grid h-7 w-7 place-items-center rounded-full border border-border/70 bg-muted text-[11px] font-semibold text-muted-foreground">
                          S
                        </span>
                      ) : null}
                    </div>
                    <div className="max-w-[84%] sm:max-w-[78%]">
                      {!groupedWithPrev ? (
                        <div className="mb-1 px-1 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/90">{systemName}</span>
                          <span className="ml-1 rounded-full border border-border/60 bg-card/60 px-1.5 py-0 text-[9px] uppercase tracking-wide">System</span>
                          <span className="px-1 text-muted-foreground/70">·</span>
                          <span className="text-[10px] text-muted-foreground/70">{formatMessageTime(msg.createdAt)}</span>
                        </div>
                      ) : null}
                      {expenseMeta ? (
                        <ExpenseCard
                          eventId={Number(msg.eventId || eventId || 0)}
                          expenseId={expenseMeta.expenseId}
                          action={expenseMeta.action}
                          fallback={{
                            item: expenseMeta.item,
                            amount: expenseMeta.amount,
                            currency: expenseMeta.currency,
                            paidBy: expenseMeta.paidBy,
                          }}
                          optimisticDeleted={optimisticallyDeletedExpenseIds.includes(expenseMeta.expenseId)}
                          onOpenEdit={openExpenseEditor}
                          onDelete={(expenseId) => { void handleDeleteExpenseFromCard(expenseId); }}
                          onCopyAmount={handleCopyAmount}
                        />
                      ) : settlementMeta ? (
                        settlementMeta.action === "settled" ? (
                          <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
                            <p className="whitespace-pre-wrap break-words font-medium">✅ All settled up</p>
                          </div>
                        ) : (
                          <SettlementCard
                            eventId={Number(msg.eventId || eventId || 0)}
                            settlementId={settlementMeta.settlementId}
                            currency={settlementMeta.currency || currency}
                          />
                        )
                      ) : settlementPaymentMeta ? (
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-300">
                          {fromName && toName && paymentAmount ? (
                            <p className="whitespace-pre-wrap break-words font-medium">
                              {fromName}
                              {" paid "}
                              {toName}
                              {" "}
                              <span className="font-semibold">{paymentAmount}</span>
                            </p>
                          ) : (
                            <p className="whitespace-pre-wrap break-words font-medium">
                              Payment recorded
                              {paymentAmount ? (
                                <>
                                  {" "}
                                  <span className="font-semibold">{paymentAmount}</span>
                                </>
                              ) : null}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                            Marked as paid
                          </p>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-[560px] rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            const senderId = String(msg.user?.id ?? "");
            const senderFromMember = senderId ? membersById.get(senderId) : undefined;
            const senderName = msg.user?.name || senderFromMember?.name || "Unknown user";
            const senderAvatar = msg.user?.avatarUrl ?? senderFromMember?.avatarUrl ?? null;
            const mine = senderId !== SYSTEM_USER_ID && (senderId === String(currentUser?.id ?? "") || msg.user?.name === currentUser?.username);
            const groupedWithPrev = isGroupedWithNeighbor(msg, previousMsg);
            return (
              <div key={msg.id}>
                {showDateSeparator ? (
                  <div className="my-2 flex justify-center">
                    <span className="self-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                ) : null}
                <div className={`group/message flex ${mine ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-1" : "mt-2"}`}>
                  {!mine ? (
                    <div className="mr-2 flex w-10 flex-col items-center pt-0.5">
                      {!groupedWithPrev ? (
                        senderAvatar ? (
                          <img src={senderAvatar} alt="" className="h-7 w-7 rounded-full border border-border/70 object-cover" />
                        ) : (
                          <span className="grid h-7 w-7 place-items-center rounded-full border border-border/70 bg-card text-[10px] font-semibold text-muted-foreground">
                            {getInitials(senderName)}
                          </span>
                        )
                      ) : null}
                    </div>
                  ) : null}
                  <div className={`${mine ? "max-w-[88%] items-end sm:max-w-[80%]" : "max-w-[88%] items-start sm:max-w-[80%]"} flex flex-col`}>
                    {!groupedWithPrev ? (
                      <div className={`mb-1 px-1 text-xs text-muted-foreground ${mine ? "text-right" : ""}`}>
                        <span className="font-medium text-foreground">
                          {mine ? "You" : senderName}
                        </span>
                        <span className="px-1.5 text-muted-foreground/70">·</span>
                        <span>{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    ) : null}
                    <div
                      className={`rounded-2xl px-4 py-2 text-sm leading-snug shadow-sm ${mine
                        ? "rounded-tr-lg bg-primary text-slate-900"
                        : "rounded-tl-lg border border-border/70 bg-background/95 text-foreground dark:bg-neutral-800/92 dark:border-neutral-700/80"}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      {msg.status === "sending" ? (
                        <div className={`mt-1 text-[10px] ${mine ? "text-slate-800/70" : "text-muted-foreground"}`}>
                          sending…
                        </div>
                      ) : null}
                      {msg.status === "failed" && msg.clientMessageId ? (
                        <div className="mt-1 flex items-center gap-2">
                          <p className={`text-[10px] ${mine ? "text-white/90" : "text-destructive"}`}>failed</p>
                          <button
                            type="button"
                            className={`text-[10px] underline underline-offset-2 ${mine ? "text-white" : "text-foreground"}`}
                            onClick={() => {
                              void retrySend(msg.clientMessageId!, {
                                id: currentUser?.id ?? null,
                                name: currentUser?.username ?? "You",
                                avatarUrl: currentUser?.avatarUrl ?? null,
                              });
                            }}
                          >
                            Retry
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      {(msg.reactions ?? []).map((reaction) => (
                        <button
                          key={`${msg.id}-${reaction.emoji}`}
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition",
                            reaction.me
                              ? "border-primary/40 bg-primary/15 text-foreground"
                              : "border-border/70 bg-card/70 text-muted-foreground hover:bg-muted/40",
                          )}
                          onClick={() => {
                            void toggleReaction({
                              messageId: msg.id,
                              emoji: reaction.emoji,
                              actorId: currentUser?.id ?? null,
                            });
                          }}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                      <Popover
                        open={reactionPickerMessageId === msg.id}
                        onOpenChange={(open) => setReactionPickerMessageId(open ? msg.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Add reaction"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card/70 text-muted-foreground opacity-100 transition md:opacity-0 md:group-hover/message:opacity-100 hover:bg-muted/50"
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align={mine ? "end" : "start"} className="w-44 p-2">
                          <div className="grid grid-cols-4 gap-1">
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={`${msg.id}-${emoji}`}
                                type="button"
                                className="grid h-8 w-8 place-items-center rounded-md text-base transition hover:bg-muted"
                                onClick={() => {
                                  void toggleReaction({
                                    messageId: msg.id,
                                    emoji,
                                    actorId: currentUser?.id ?? null,
                                  });
                                  setReactionPickerMessageId(null);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border/70 bg-background/90 px-6 py-3 backdrop-blur">
        {isLocked ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Chat closed after event. History remains visible.
          </p>
        ) : null}
        <div className="mb-2 min-h-5">
          {visibleTypingUsers.length > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">
                {visibleTypingUsers[0]?.name}
                {visibleTypingUsers.length > 1 ? ` +${visibleTypingUsers.length - 1}` : ""} is typing…
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-10 w-10 shrink-0 rounded-full border-border/70 bg-background/85 text-muted-foreground hover:bg-muted/50"
            aria-label="Attach file"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <div
            className="flex max-h-[132px] flex-1 items-end rounded-2xl border border-border/70 bg-background px-4 py-2.5"
            onMouseDown={(e) => {
              if (isLocked) return;
              e.preventDefault();
              inputRef.current?.focus();
              debugFocusBlock();
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={() => emitTypingStop()}
              placeholder="Message…"
              className="pointer-events-auto min-h-[24px] max-h-[104px] w-full resize-none overflow-y-auto bg-transparent text-[16px] leading-normal text-foreground caret-primary outline-none placeholder:text-muted-foreground md:text-sm disabled:cursor-not-allowed disabled:text-muted-foreground/70"
              rows={1}
              disabled={isLocked}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-primary text-slate-900 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => void handleSubmit()}
            disabled={isLocked || sending || !draft.trim() || !eventId}
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
