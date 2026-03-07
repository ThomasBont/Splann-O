import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CreditCard, Loader2, MapPin, MessageCircle, MoreHorizontal, Paperclip, Reply, SendHorizontal, Smile, Users } from "lucide-react";
import { InlineQueryError, SkeletonLine } from "@/components/ui/load-states";
import { useEventChat } from "@/hooks/use-event-chat";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventMembers } from "@/hooks/use-participants";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { useIsMobile } from "@/hooks/use-mobile";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
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

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const QUICK_EMOJIS = ["😀", "😂", "😍", "🙏", "🔥", "🎉", "👍", "❤️"];
const NEAR_BOTTOM_THRESHOLD_PX = 120;
const AMOUNT_PATTERN = /€\s?(\d+(?:[.,]\d{1,2})?)/i;
const PAID_BY_PATTERN = /(paid by|by)\s+@?(\w+)/i;
const SPLIT_PATTERN = /(split)\s+(\d+)/i;

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

function parseExpenseSuggestion(text: string): {
  amount?: number;
  paidBy?: string;
  splitCount?: number;
  description?: string;
} | null {
  const source = text.trim();
  if (!source) return null;
  const amountMatch = source.match(AMOUNT_PATTERN);
  const paidByMatch = source.match(PAID_BY_PATTERN);
  const splitMatch = source.match(SPLIT_PATTERN);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : undefined;
  const paidBy = paidByMatch?.[2]?.trim();
  const splitCount = splitMatch ? Number(splitMatch[2]) : undefined;

  let description = source;
  if (amountMatch?.[0]) description = description.replace(amountMatch[0], " ");
  if (paidByMatch?.[0]) description = description.replace(paidByMatch[0], " ");
  if (splitMatch?.[0]) description = description.replace(splitMatch[0], " ");
  description = description.replace(/\s+/g, " ").trim();

  const hasAny = (Number.isFinite(amount) && (amount ?? 0) > 0) || !!paidBy || (Number.isFinite(splitCount) && (splitCount ?? 0) > 0);
  if (!hasAny) return null;
  return {
    amount: Number.isFinite(amount) && (amount ?? 0) > 0 ? amount : undefined,
    paidBy: paidBy || undefined,
    splitCount: Number.isFinite(splitCount) && (splitCount ?? 0) > 0 ? Math.floor(splitCount!) : undefined,
    description: description || undefined,
  };
}

function summarizeMessageReactions(
  reactions: Array<{ emoji: string; count: number; me?: boolean }>,
): Array<{ emoji: string; count: number; me: boolean }> {
  const byEmoji = new Map<string, { emoji: string; count: number; me: boolean }>();
  for (const reaction of reactions) {
    const emoji = String(reaction.emoji ?? "").trim();
    if (!emoji) continue;
    const existing = byEmoji.get(emoji);
    const nextCount = Number.isFinite(reaction.count) ? reaction.count : 0;
    if (existing) {
      existing.count += nextCount;
      existing.me = existing.me || !!reaction.me;
    } else {
      byEmoji.set(emoji, {
        emoji,
        count: nextCount,
        me: !!reaction.me,
      });
    }
  }
  return Array.from(byEmoji.values()).filter((item) => item.count > 0);
}

function isGroupedWithNeighbor(
  current: { type?: string; createdAt: string; user?: { id?: string | null; name?: string | null } },
  neighbor?: { type?: string; createdAt: string; user?: { id?: string | null; name?: string | null } },
): boolean {
  if (!neighbor) return false;
  if (current.type !== "user" || neighbor.type !== "user") return false;
  const currentKey = getMessageSenderKey(current);
  const neighborKey = getMessageSenderKey(neighbor);
  if (!currentKey || !neighborKey || currentKey !== neighborKey) return false;
  const currentTime = new Date(current.createdAt).getTime();
  const neighborTime = new Date(neighbor.createdAt).getTime();
  if (!Number.isFinite(currentTime) || !Number.isFinite(neighborTime)) return false;
  const currentDate = new Date(current.createdAt);
  const neighborDate = new Date(neighbor.createdAt);
  if (Number.isNaN(currentDate.getTime()) || Number.isNaN(neighborDate.getTime())) return false;
  if (!isSameDay(currentDate, neighborDate)) return false;
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
  const { openPanel, panel } = usePanel();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingEmitTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const isNearBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const prevMessageLengthRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | null>(null);
  const olderHistoryAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const [unseenCount, setUnseenCount] = useState(0);
  const [showNewPill, setShowNewPill] = useState(false);
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

  const computeIsNearBottom = useCallback((el: HTMLDivElement): boolean => {
    const remaining = el.scrollHeight - (el.scrollTop + el.clientHeight);
    return remaining < NEAR_BOTTOM_THRESHOLD_PX;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const nearBottom = computeIsNearBottom(el);
        isNearBottomRef.current = nearBottom;
        setIsNearBottom((prev) => (prev === nearBottom ? prev : nearBottom));
        if (nearBottom) {
          setUnseenCount(0);
          setShowNewPill(false);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [computeIsNearBottom]);

  useEffect(() => {
    const nextLength = messages.length;
    const prevLength = prevMessageLengthRef.current;
    const nextLastId = nextLength > 0 ? messages[nextLength - 1]?.id ?? null : null;

    if (!didInitialScrollRef.current && nextLength > 0) {
      scrollToBottom("auto");
      didInitialScrollRef.current = true;
      prevMessageLengthRef.current = nextLength;
      prevLastMessageIdRef.current = nextLastId;
      setUnseenCount(0);
      setShowNewPill(false);
      return;
    }

    if (nextLength > prevLength && prevLength > 0) {
      const prevLastId = prevLastMessageIdRef.current;
      const appendOnly = !!prevLastId && messages[prevLength - 1]?.id === prevLastId;
      if (appendOnly && !historyLoadingOlder) {
        if (isNearBottomRef.current) {
          scrollToBottom("smooth");
        } else {
          const addedCount = Math.max(1, nextLength - prevLength);
          setUnseenCount((count) => count + addedCount);
          setShowNewPill(true);
        }
      }
    }

    prevMessageLengthRef.current = nextLength;
    prevLastMessageIdRef.current = nextLastId;
  }, [messages, historyLoadingOlder, scrollToBottom]);

  useLayoutEffect(() => {
    if (historyLoadingOlder) return;
    const anchor = olderHistoryAnchorRef.current;
    const el = listRef.current;
    if (!anchor || !el) return;

    const delta = el.scrollHeight - anchor.scrollHeight;
    el.scrollTop = anchor.scrollTop + Math.max(delta, 0);
    olderHistoryAnchorRef.current = null;
  }, [historyLoadingOlder, messages]);

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
  const expenseSuggestion = useMemo(() => parseExpenseSuggestion(draft), [draft]);

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
    queryClient.setQueryData(["expenses", eventId], (old: unknown) => {
      if (!Array.isArray(old)) return old;
      return old.filter((item) => Number((item as { id?: number }).id) !== expenseId);
    });
    try {
      await deleteExpense.mutateAsync(expenseId);
    } catch (error) {
      setOptimisticallyDeletedExpenseIds((prev) => prev.filter((id) => id !== expenseId));
      await queryClient.invalidateQueries({ queryKey: ['/api/barbecues', eventId, 'expenses'] });
      await queryClient.invalidateQueries({ queryKey: ["expenses", eventId] });
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
  const hasEventId = Number.isFinite(Number(eventId)) && Number(eventId) > 0;
  const openPlanDetails = () => {
    if (isMobile) {
      onSummaryClick?.();
      return;
    }
    openPanel({ type: "plan-details" });
  };
  const openCrew = () => {
    if (!hasEventId) return;
    if (isMobile) {
      window.dispatchEvent(new CustomEvent("splanno:open-crew", { detail: { eventId } }));
      return;
    }
    openPanel({ type: "crew" });
  };
  const openExpenses = () => {
    if (!hasEventId) return;
    if (isMobile) {
      window.dispatchEvent(new CustomEvent("splanno:open-expenses", { detail: { eventId } }));
      return;
    }
    openPanel({ type: "expenses" });
  };
  const openCreateExpenseFromSuggestion = () => {
    if (!hasEventId || !expenseSuggestion) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expenses", {
      detail: {
        eventId,
        initialView: "expense-form",
        prefill: {
          amount: expenseSuggestion.amount ?? null,
          item: expenseSuggestion.description ?? null,
          paidBy: expenseSuggestion.paidBy ?? null,
          splitCount: expenseSuggestion.splitCount ?? null,
        },
      },
    }));
  };
  const isExpensesOpen = panel?.type === "expenses";
  const isCrewOpen = panel?.type === "crew";
  const isPlanDetailsOpen = panel?.type === "plan-details";
  const isAnyPanelOpen = panel !== null;
  const openExpenseDetail = useCallback((expenseId: number) => {
    if (isMobile) {
      openExpenseEditor(expenseId);
      return;
    }
    openPanel({ type: "expense", id: String(expenseId) });
  }, [isMobile, openExpenseEditor, openPanel]);
  const handleLoadOlder = useCallback(async () => {
    if (historyLoadingOlder) return;
    const el = listRef.current;
    olderHistoryAnchorRef.current = el
      ? { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop }
      : null;
    await loadOlder();
  }, [historyLoadingOlder, loadOlder]);
  const messageGroups = useMemo(() => {
    type ChatMessage = (typeof messages)[number];
    type MessageGroup = {
      id: string;
      isSystem: boolean;
      senderKey: string | null;
      messages: ChatMessage[];
      startTs: number;
      lastTs: number;
    };
    const groups: MessageGroup[] = [];
    for (const message of messages) {
      const timestamp = new Date(message.createdAt).getTime();
      const safeTs = Number.isFinite(timestamp) ? timestamp : Date.now();
      if (message.type === "system") {
        groups.push({
          id: `sys-${message.id}`,
          isSystem: true,
          senderKey: null,
          messages: [message],
          startTs: safeTs,
          lastTs: safeTs,
        });
        continue;
      }
      const senderKey = getMessageSenderKey(message) ?? `user:fallback:${message.id}`;
      const lastGroup = groups[groups.length - 1];
      const lastMessageInGroup = lastGroup?.messages[lastGroup.messages.length - 1];
      const lastMessageTs = lastMessageInGroup ? new Date(lastMessageInGroup.createdAt).getTime() : NaN;
      const sameDayAsLast = lastMessageInGroup
        ? isSameDay(new Date(lastMessageInGroup.createdAt), new Date(message.createdAt))
        : false;
      if (
        lastGroup
        && !lastGroup.isSystem
        && lastGroup.senderKey === senderKey
        && Number.isFinite(lastMessageTs)
        && Math.abs(safeTs - lastMessageTs) < GROUP_WINDOW_MS
        && sameDayAsLast
      ) {
        lastGroup.messages.push(message);
        lastGroup.lastTs = safeTs;
      } else {
        groups.push({
          id: `usr-${message.id}`,
          isSystem: false,
          senderKey,
          messages: [message],
          startTs: safeTs,
          lastTs: safeTs,
        });
      }
    }
    return groups;
  }, [messages]);
  const rowVirtualizer = useVirtualizer({
    count: messageGroups.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <aside
      className={cn("pointer-events-auto relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--surface-1))]", className)}
      style={
        {
          "--chat-bg":
            "radial-gradient(1250px 760px at 10% 4%, hsl(var(--muted)/0.1), transparent 68%), radial-gradient(960px 560px at 86% 90%, hsl(var(--primary)/0.03), transparent 70%), hsl(var(--background))",
        } as CSSProperties
      }
    >
      <header className="shrink-0 border-b border-black/5 bg-[hsl(var(--surface-1))] px-6 py-4 dark:border-white/6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              aria-label="Open plan details"
              onClick={openPlanDetails}
              className={cn(
                "block max-w-full rounded-md text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isPlanDetailsOpen
                  ? "text-foreground"
                  : "text-foreground/95 hover:text-foreground",
              )}
            >
              <span className="block truncate text-xl font-semibold tracking-tight">Chat</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-card px-2 py-1 text-[10px] text-muted-foreground dark:border-white/6">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${liveLabel.cls}`} />
              {liveLabel.text}
            </div>
          </div>
        </div>
        <div className="mt-3 flex w-full flex-wrap items-center gap-x-1 gap-y-1.5 text-sm text-muted-foreground">
          <button
            type="button"
            aria-label="Open plan location details"
            onClick={openPlanDetails}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isPlanDetailsOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{locationLabel}</span>
          </button>
          <span className="text-muted-foreground/45">•</span>
          <button
            type="button"
            aria-label="Open crew drawer"
            onClick={openCrew}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isCrewOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{peopleLabel}</span>
          </button>
          <span className="text-muted-foreground/45">•</span>
          <button
            type="button"
            aria-label="Open plan date details"
            onClick={openPlanDetails}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isPlanDetailsOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>{dateLabel}</span>
          </button>
          <span className="text-muted-foreground/45">•</span>
          <button
            type="button"
            aria-label="Open shared costs drawer"
            onClick={openExpenses}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isExpensesOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span className={cn("font-medium", isExpensesOpen ? "text-foreground" : "")}>{sharedLabel}</span>
          </button>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--chat-bg)]"
      >
        <div
          className={cn(
            "mx-auto flex min-h-full w-full py-4 sm:py-6",
            isAnyPanelOpen
              ? "max-w-3xl px-6 sm:px-8 lg:px-10"
              : "max-w-[1040px] px-4 sm:px-8",
          )}
        >
        <div className="flex min-h-full w-full flex-col justify-end gap-2">
        {hasMoreHistory ? (
          <div className="flex justify-center pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-3 text-xs text-muted-foreground"
              onClick={() => void handleLoadOlder()}
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
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {virtualRows.map((virtualRow) => {
              const group = messageGroups[virtualRow.index];
              if (!group) return null;
              const firstMsg = group.messages[0];
              if (!firstMsg) return null;
              const previousGroup = virtualRow.index > 0 ? messageGroups[virtualRow.index - 1] : null;
              const previousDate = previousGroup?.messages[0]?.createdAt;
              const showDateSeparator = !previousDate
                || !isSameDay(new Date(firstMsg.createdAt), new Date(previousDate));

              if (group.isSystem) {
                const msg = firstMsg;
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
                  || (settlementPaymentMeta ? membersById.get(String(settlementPaymentMeta.fromUserId))?.name : null)
                  || null;
                const toName = paymentTransfer?.toName
                  || (settlementPaymentMeta ? membersById.get(String(settlementPaymentMeta.toUserId))?.name : null)
                  || null;
                const paymentAmount = settlementPaymentMeta
                  ? formatMoneyForSystem(
                    paymentTransfer?.amount ?? settlementPaymentMeta.amount,
                    paymentTransfer?.currency ?? settlementPaymentMeta.currency,
                  )
                  : null;
                return (
                  <div
                    key={group.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="mb-5">
                      {showDateSeparator ? (
                        <div className="my-2 flex justify-center">
                          <span className="self-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                            {formatDateSeparator(msg.createdAt)}
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
                            <span className="text-[10px] text-muted-foreground/70">{formatMessageTime(msg.createdAt)}</span>
                          </div>
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
                              onOpenDetail={openExpenseDetail}
                              onDelete={(expenseId) => { void handleDeleteExpenseFromCard(expenseId); }}
                              onCopyAmount={handleCopyAmount}
                            />
                          ) : settlementMeta ? (
                            <SettlementCard
                              eventId={Number(msg.eventId || eventId || 0)}
                              settlementId={settlementMeta.settlementId}
                              currency={settlementMeta.currency || currency}
                            />
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
                  </div>
                );
              }

              const senderId = String(firstMsg.user?.id ?? "");
              const senderFromMember = senderId ? membersById.get(senderId) : undefined;
              const senderName = firstMsg.user?.name || senderFromMember?.name || "Unknown user";
              const senderAvatar = firstMsg.user?.avatarUrl ?? senderFromMember?.avatarUrl ?? null;
              const mine = senderId !== SYSTEM_USER_ID
                && (senderId === String(currentUser?.id ?? "") || firstMsg.user?.name === currentUser?.username);
              const latestMessage = group.messages[group.messages.length - 1];
              const groupReactionSummary = summarizeMessageReactions(
                group.messages.flatMap((message) => message.reactions ?? []),
              );
              const hasGroupReactions = groupReactionSummary.length > 0;

              return (
                <div
                  key={group.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className="mb-5">
                    {showDateSeparator ? (
                      <div className="my-2 flex justify-center">
                        <span className="self-center rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                          {formatDateSeparator(firstMsg.createdAt)}
                        </span>
                      </div>
                    ) : null}
                    <div className={cn("mt-4 flex items-start", mine ? "justify-end" : "justify-start gap-3")}>
                      {!mine ? (
                        <div className="w-8 shrink-0 pt-0.5">
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="" className="h-7 w-7 rounded-full border border-border/70 object-cover" />
                          ) : (
                            <span className="grid h-7 w-7 place-items-center rounded-full border border-border/70 bg-card text-[10px] font-semibold text-muted-foreground">
                              {getInitials(senderName)}
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className={cn("flex flex-col", mine ? "max-w-[88%] items-end sm:max-w-[80%]" : "max-w-[88%] items-start sm:max-w-[80%]")}>
                        <div className={cn("mb-1 px-1 text-xs text-muted-foreground", mine ? "text-right" : "")}>
                          <span className="font-medium text-foreground">{mine ? "You" : senderName}</span>
                          <span className="px-1.5 text-muted-foreground/70">·</span>
                          <span>{formatMessageTime(firstMsg.createdAt)}</span>
                        </div>
                        <div className={cn("group/bubble inline-flex flex-col", mine ? "items-end" : "items-start")}>
                          <div className={cn("flex items-center gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                            <div
                              className={cn(
                                "rounded-2xl px-4 py-2 text-sm leading-snug shadow-sm",
                                mine
                                  ? "bg-primary text-slate-900"
                                  : "border border-border/70 bg-background/95 text-foreground dark:bg-neutral-800/92 dark:border-neutral-700/80",
                              )}
                            >
                              <div className="flex flex-col gap-1.5">
                                {group.messages.map((msg, msgIndexInGroup) => (
                                  <div
                                    key={msg.id}
                                    className={cn(
                                      "whitespace-pre-wrap break-words leading-snug",
                                      msgIndexInGroup > 0 ? "border-t border-border/40 pt-1" : "",
                                    )}
                                  >
                                    <p>{msg.text}</p>
                                    {msg.status === "sending" ? (
                                      <div className={cn("mt-1 text-[10px]", mine ? "text-slate-800/70" : "text-muted-foreground")}>
                                        sending…
                                      </div>
                                    ) : null}
                                    {msg.status === "failed" && msg.clientMessageId ? (
                                      <div className="mt-1 flex items-center gap-2">
                                        <p className={cn("text-[10px]", mine ? "text-white/90" : "text-destructive")}>failed</p>
                                        <button
                                          type="button"
                                          className={cn("text-[10px] underline underline-offset-2", mine ? "text-white" : "text-foreground")}
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
                                ))}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "pointer-events-none hidden items-center gap-1 opacity-0 transition duration-150 md:flex md:group-hover/bubble:pointer-events-auto md:group-hover/bubble:opacity-100",
                              )}
                            >
                              <Popover
                                open={reactionPickerMessageId === latestMessage.id}
                                onOpenChange={(open) => setReactionPickerMessageId(open ? latestMessage.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="React to message"
                                    className={`${circularActionButtonClass()} inline-flex h-7 w-7 items-center justify-center`}
                                  >
                                    <Smile className="h-3.5 w-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent align={mine ? "end" : "start"} className="w-44 p-2">
                                  <div className="grid grid-cols-4 gap-1">
                                    {QUICK_EMOJIS.map((emoji) => (
                                      <button
                                        key={`${latestMessage.id}-hover-${emoji}`}
                                        type="button"
                                        className="grid h-8 w-8 place-items-center rounded-md text-base transition hover:bg-muted"
                                        onClick={() => {
                                          void toggleReaction({
                                            messageId: latestMessage.id,
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
                              <button
                                type="button"
                                aria-label="Reply to message"
                                className={`${circularActionButtonClass()} inline-flex h-7 w-7 items-center justify-center`}
                                onClick={() => {
                                  const replyTarget = mine ? "You" : senderName;
                                  const prefix = `@${replyTarget} `;
                                  setDraft((prev) => (prev.trim() ? `${prefix}${prev}` : prefix));
                                  inputRef.current?.focus();
                                }}
                              >
                                <Reply className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="More message actions"
                                className={`${circularActionButtonClass()} inline-flex h-7 w-7 items-center justify-center`}
                                onClick={() => toastInfo("More actions coming soon.")}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {hasGroupReactions ? (
                            <div className={cn("mt-1 flex gap-1", mine ? "justify-end self-end" : "justify-start self-start")}>
                              {groupReactionSummary.map((reaction) => (
                                <button
                                  key={`${group.id}-${reaction.emoji}`}
                                  type="button"
                                  className={cn(
                                    "flex items-center gap-1 rounded-full border bg-background/80 px-2 py-[2px] text-xs transition",
                                    reaction.me
                                      ? "border-primary/40 text-foreground"
                                      : "border-border/70 text-muted-foreground hover:text-foreground",
                                  )}
                                  onClick={() => {
                                    void toggleReaction({
                                      messageId: latestMessage.id,
                                      emoji: reaction.emoji,
                                      actorId: currentUser?.id ?? null,
                                    });
                                  }}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span>{reaction.count}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
        </div>
      </div>

      {showNewPill && unseenCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            scrollToBottom("smooth");
            setUnseenCount(0);
            setShowNewPill(false);
          }}
          className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/60 bg-background/90 px-4 py-2 text-sm text-foreground shadow-md backdrop-blur-md transition hover:bg-background"
        >
          {unseenCount > 1 ? `${unseenCount} new messages ↓` : "New messages ↓"}
        </button>
      ) : null}

      <div className="shrink-0 border-t border-border/70 bg-background/90 px-6 py-1 backdrop-blur">
        {expenseSuggestion ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {expenseSuggestion.amount ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  €{expenseSuggestion.amount.toFixed(2)}
                </span>
              ) : null}
              {expenseSuggestion.paidBy ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  paid by @{expenseSuggestion.paidBy}
                </span>
              ) : null}
              {expenseSuggestion.splitCount ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  split {expenseSuggestion.splitCount}
                </span>
              ) : null}
              {expenseSuggestion.description ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  {expenseSuggestion.description}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0"
              onClick={openCreateExpenseFromSuggestion}
            >
              Create expense
            </Button>
          </div>
        ) : null}
        {isLocked ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Chat closed after event. History remains visible.
          </p>
        ) : null}
        <div className="mb-0 min-h-3">
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={`h-10 w-10 shrink-0 ${circularActionButtonClass()}`}
            aria-label="Attach file"
            disabled
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <div
            className="flex min-h-10 max-h-[132px] flex-1 items-center rounded-2xl border border-border/70 bg-background px-4 py-1.5"
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
              className="pointer-events-auto min-h-[20px] max-h-[104px] w-full resize-none overflow-y-auto bg-transparent py-0.5 text-[16px] leading-normal text-foreground caret-primary outline-none placeholder:text-muted-foreground md:text-sm disabled:cursor-not-allowed disabled:text-muted-foreground/70"
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
