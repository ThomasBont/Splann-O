import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, Copy, CreditCard, FileText, ImageIcon, Loader2, MapPin, MessageCircle, MoreHorizontal, Paperclip, Pencil, Receipt, Reply, SendHorizontal, Smile, Trash2, Users, X } from "lucide-react";
import { InlineQueryError, SkeletonLine } from "@/components/ui/load-states";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEventChat } from "@/hooks/use-event-chat";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventMembers } from "@/hooks/use-participants";
import { useDeleteExpense } from "@/hooks/use-expenses";
import { useIsMobile } from "@/hooks/use-mobile";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatFullDate } from "@/lib/dates";
import { getClientPlanStatus, getPlanCloseAt } from "@/lib/plan-lifecycle";
import { getChatPatternStyle } from "@/lib/chat-pattern";
import { markPlanSwitchPerf } from "@/lib/plan-switch-perf";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import type { SendMessageResult } from "@/hooks/use-event-chat";
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from "@shared/lib/system-user";
import { ExpenseCard, type ExpenseMessageMetadata } from "@/components/event/chat/ExpenseCard";
import { PollMessage } from "@/components/event/chat/PollMessage";
import { SettlementCard } from "@/components/event/chat/SettlementCard";

type ChatSidebarProps = {
  eventId: number | null;
  eventName?: string | null;
  eventType?: string | null;
  templateData?: unknown;
  planStatus?: string | null;
  settledAt?: string | Date | null;
  planEndDate?: string | Date | null;
  location?: string | null;
  dateTime?: Date | string | null;
  participantCount?: number;
  sharedTotal?: number;
  expenseCount?: number;
  currency?: string;
  onSummaryClick?: () => void;
  currentUser?: { id?: number | null; username?: string | null; avatarUrl?: string | null } | null;
  enabled?: boolean;
  className?: string;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const QUICK_EMOJIS = ["😀", "😂", "😍", "🙏", "🔥", "🎉", "👍", "❤️"];
const NEAR_BOTTOM_THRESHOLD_PX = 120;
const MOBILE_HEADER_COLLAPSE_SCROLL_PX = 28;
const AMOUNT_PATTERN = /€\s?(\d+(?:[.,]\d{1,2})?)/i;
const PAID_BY_PATTERN = /(paid by|by)\s+@?(\w+)/i;
const SPLIT_PATTERN = /(split)\s+(\d+)/i;
let chatSidebarDevInstanceCounter = 0;

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
  const resolutionMode = typeof input.resolutionMode === "string" ? input.resolutionMode : String(input.resolutionMode ?? "").trim();
  const linkedSettlementRoundId = String(input.linkedSettlementRoundId ?? "").trim();
  const actorName = typeof input.actorName === "string" ? input.actorName : String(input.actorName ?? "").trim();
  return {
    action,
    expenseId,
    item: item || "Expense",
    amount: Number.isFinite(amount) ? amount : 0,
    currency: currency || "€",
    paidBy: paidBy || "Someone",
    actorName: actorName || paidBy || "Someone",
    resolutionMode,
    linkedSettlementRoundId: linkedSettlementRoundId || undefined,
  };
}

type SettlementMetadata = {
  type: "settlement";
  settlementId: string;
  action: "started" | "completed";
  currency: string;
};

type SettlementPaymentMetadata = {
  type: "settlement_payment";
  settlementId: string;
  settlementRoundId?: string;
  transferId: string;
  fromUserId: number;
  toUserId: number;
  amount: number;
  currency: string;
  status: "paid";
};

type PollMetadata = {
  type: "poll";
  pollId: string;
};

type ReplyToMetadata = {
  id: string;
  senderName: string;
  text: string;
};

type EditingMessageState = {
  id: string;
  originalText: string;
};

type PendingAttachment = {
  kind: "image" | "file";
  file: File;
  previewUrl?: string | null;
};

type UploadedAttachment = {
  kind: "image" | "file";
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

type ViewerImage = {
  src: string;
  alt: string;
};

const MAX_IMAGE_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_FILE_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const FILE_ATTACHMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv,.json,.rtf,.md";

function toSettlementMetadata(input: Record<string, unknown> | null | undefined): SettlementMetadata | null {
  if (!input || input.type !== "settlement") return null;
  const settlementId = String(input.settlementRoundId ?? input.settlementId ?? "").trim();
  if (!settlementId) return null;
  const rawAction = input.action;
  const action = rawAction === "proposed" ? "started" : rawAction === "settled" ? "completed" : rawAction;
  if (action !== "started" && action !== "completed") return null;
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
    status: "active" | "completed" | "cancelled";
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
  const settlementId = String(input.settlementRoundId ?? input.settlementId ?? "").trim();
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

function toPollMetadata(input: Record<string, unknown> | null | undefined): PollMetadata | null {
  if (!input || input.type !== "poll") return null;
  const pollId = String(input.pollId ?? "").trim();
  if (!pollId) return null;
  return {
    type: "poll",
    pollId,
  };
}

function toReplyToMetadata(input: Record<string, unknown> | null | undefined): ReplyToMetadata | null {
  if (!input || typeof input !== "object") return null;
  const replyTo = input.replyTo;
  if (!replyTo || typeof replyTo !== "object") return null;
  const id = String((replyTo as Record<string, unknown>).id ?? "").trim();
  const senderName = String((replyTo as Record<string, unknown>).senderName ?? "").trim();
  const text = String((replyTo as Record<string, unknown>).text ?? "").trim();
  if (!id || !senderName || !text) return null;
  return { id, senderName, text };
}

function toAttachmentMetadata(input: Record<string, unknown> | null | undefined): UploadedAttachment | null {
  if (!input || input.type !== "attachment") return null;
  const attachment = input.attachment;
  if (!attachment || typeof attachment !== "object") return null;
  const raw = attachment as Record<string, unknown>;
  const kind = raw.kind === "image" ? "image" : raw.kind === "file" ? "file" : null;
  const fileName = String(raw.fileName ?? "").trim();
  const mimeType = String(raw.mimeType ?? "").trim();
  const url = String(raw.url ?? "").trim();
  const size = Number(raw.size);
  if (!kind || !fileName || !mimeType || !url || !Number.isFinite(size)) return null;
  return {
    kind,
    fileName,
    mimeType,
    size,
    url,
  };
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
  eventType = null,
  templateData,
  planStatus,
  settledAt = null,
  planEndDate = null,
  location = null,
  dateTime = null,
  participantCount = 0,
  sharedTotal = 0,
  expenseCount = 0,
  currency = "EUR",
  onSummaryClick,
  currentUser,
  enabled = true,
  className,
}: ChatSidebarProps) {
  const normalizedPlanStatus = getClientPlanStatus(planStatus);
  const chatClosesAt = getPlanCloseAt(planEndDate ?? dateTime);
  const chatClosesLabel = formatFullDate(chatClosesAt);
  const { toastError, toastInfo } = useAppToast();
  const { openPanel, panel } = usePanel();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyToMetadata | null>(null);
  const [editingMessage, setEditingMessage] = useState<EditingMessageState | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState<ViewerImage | null>(null);
  const [sending, setSending] = useState(false);
  const devInstanceIdRef = useRef<number>(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingEmitTimerRef = useRef<number | null>(null);
  const typingStopTimerRef = useRef<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isMobileHeaderCondensed, setIsMobileHeaderCondensed] = useState(false);
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
    editMessage,
    deleteMessage,
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
        if (isMobile) {
          const shouldCondense = el.scrollTop > MOBILE_HEADER_COLLAPSE_SCROLL_PX;
          setIsMobileHeaderCondensed((prev) => (prev === shouldCondense ? prev : shouldCondense));
        }
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
  }, [computeIsNearBottom, isMobile]);

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

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

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
    const hasPendingAttachment = !!pendingAttachment;
    if (import.meta.env.DEV) {
      console.log("[chat-send]", {
        textLen: text.length,
        hasPendingAttachment,
        isLocked,
        eventId,
        transport: "ws",
        wsState: wsReadyState,
        isSubscribed,
        sending,
      });
    }
    if (sending) return;

    if (!text && !hasPendingAttachment) {
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
    if (editingMessage) {
      try {
        await editMessage(editingMessage.id, text);
      } catch (error) {
        toastError(error instanceof Error ? error.message : "Couldn’t edit message.");
        return;
      }
      emitTypingStop();
      setDraft("");
      setEditingMessage(null);
      return;
    }
    setSending(true);
    const replyMetadata = replyingTo
      ? {
          replyTo: {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            text: replyingTo.text,
          },
        }
      : undefined;
    let attachmentMetadata: UploadedAttachment | undefined;
    if (pendingAttachment) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string" && reader.result) {
              resolve(reader.result);
              return;
            }
            reject(new Error("Couldn’t read attachment"));
          };
          reader.onerror = () => reject(new Error("Couldn’t read attachment"));
          reader.readAsDataURL(pendingAttachment.file);
        });

        const upload = async (url: string) => {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              kind: pendingAttachment.kind,
              fileName: pendingAttachment.file.name,
              dataUrl,
            }),
          });
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message = (payload as { message?: string }).message || "Attachment upload failed";
            const error = new Error(message) as Error & { status?: number };
            error.status = res.status;
            throw error;
          }
          return payload as UploadedAttachment;
        };

        let uploaded: UploadedAttachment;
        try {
          uploaded = await upload(`/api/plans/${eventId}/chat/attachments`);
        } catch (error) {
          const status = typeof (error as { status?: unknown }).status === "number"
            ? (error as { status?: number }).status
            : null;
          if (status !== 404) throw error;
          uploaded = await upload(`/api/events/${eventId}/chat/attachments`);
        }
        attachmentMetadata = uploaded;
      } catch (error) {
        setSending(false);
        toastError(error instanceof Error ? error.message : "Attachment upload failed.");
        return;
      }
    }

    const outgoingMetadata = {
      ...(attachmentMetadata ? { type: "attachment" as const, attachment: attachmentMetadata } : {}),
      ...(replyMetadata ?? {}),
    };
    const outgoingText = text || attachmentMetadata?.fileName || "";
    if (!outgoingText) {
      setSending(false);
      return;
    }
    let result: SendMessageResult;
    try {
      result = await sendMessage(outgoingText, {
        id: currentUser?.id ?? null,
        name: currentUser?.username ?? "You",
        avatarUrl: currentUser?.avatarUrl ?? null,
      }, Object.keys(outgoingMetadata).length > 0 ? outgoingMetadata : undefined);
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
    setReplyingTo(null);
    clearPendingAttachment();
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
  const expenseSuggestion = useMemo(() => {
    const parsed = parseExpenseSuggestion(draft);
    if (!parsed) return null;
    const author = currentUser?.id ? membersById.get(String(currentUser.id)) : null;
    const defaultPaidBy = author?.name || currentUser?.username || undefined;
    return {
      ...parsed,
      paidBy: parsed.paidBy ?? defaultPaidBy,
    };
  }, [currentUser?.id, currentUser?.username, draft, membersById]);

  const openExpenseEditor = useCallback((expenseId: number) => {
    if (!eventId) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expense", {
      detail: { eventId, expenseId },
    }));
  }, [eventId]);

  const handleDeleteExpenseFromCard = useCallback(async (expenseId: number) => {
    if (!eventId) return;
    const currentExpenses = queryClient.getQueryData(['/api/barbecues', eventId, 'expenses']);
    const targetExpense = Array.isArray(currentExpenses)
      ? currentExpenses.find((item) => Number((item as { id?: number }).id) === expenseId) as { createdByUserId?: number | null } | undefined
      : undefined;
    if (Number(targetExpense?.createdByUserId ?? 0) !== Number(currentUser?.id ?? 0)) {
      toastError("Only the person who created this expense can delete it.");
      return;
    }
    if (!window.confirm("Delete this expense? This will permanently remove it from shared costs.")) {
      return;
    }
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
  }, [currentUser?.id, deleteExpense, eventId, queryClient, toastError]);

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
  const expensesLabel = `${expenseCount} expense${expenseCount === 1 ? "" : "s"}`;
  const chatPatternStyle = useMemo(() => getChatPatternStyle({ eventType, templateData }), [eventType, templateData]);
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
  const openPhotos = () => {
    if (!hasEventId) return;
    openPanel({ type: "photos" });
  };
  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const selectAttachmentKind = useCallback((kind: "image" | "file") => {
    if (!hasEventId) return;
    setIsAttachmentMenuOpen(false);
    if (kind === "image") {
      imageInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  }, [hasEventId]);

  const handleAttachmentSelection = useCallback((kind: "image" | "file", fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    const maxSize = kind === "image" ? MAX_IMAGE_ATTACHMENT_SIZE_BYTES : MAX_FILE_ATTACHMENT_SIZE_BYTES;
    if (file.size > maxSize) {
      toastError(kind === "image" ? "Image must be 10MB or smaller." : "File must be 20MB or smaller.");
      return;
    }

    if (kind === "image" && !file.type.startsWith("image/")) {
      toastError("Choose an image file.");
      return;
    }

    setPendingAttachment((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return {
        kind,
        file,
        previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
      };
    });
  }, [toastError]);

  const handleImageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    handleAttachmentSelection("image", event.target.files);
    event.target.value = "";
  }, [handleAttachmentSelection]);

  const handleFileInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    handleAttachmentSelection("file", event.target.files);
    event.target.value = "";
  }, [handleAttachmentSelection]);

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
  const lockedComposerPlaceholder = normalizedPlanStatus === "archived"
    ? "This plan is archived and read-only"
    : normalizedPlanStatus === "settled" || normalizedPlanStatus === "closed"
      ? "This plan is closed. Settlement can still be completed."
        : "Chat is read-only for this plan";
  const isExpensesOpen = panel?.type === "expenses";
  const isPhotosOpen = panel?.type === "photos";
  const isCrewOpen = panel?.type === "crew";
  const isPlanDetailsOpen = panel?.type === "plan-details";
  const isAnyPanelOpen = panel !== null;
  const hasTopHistoryAction = hasMoreHistory;
  const pendingAttachmentSizeLabel = pendingAttachment ? formatAttachmentSize(pendingAttachment.file.size) : "";
  const isImageViewerOpen = !!viewerImage;
  const startEditingMessage = useCallback((message: { id: string; text: string }) => {
    setEditingMessage({ id: message.id, originalText: message.text });
    setReplyingTo(null);
    clearPendingAttachment();
    setDraft(message.text);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(message.text.length, message.text.length);
    });
  }, [clearPendingAttachment]);
  const cancelEditingMessage = useCallback(() => {
    setEditingMessage(null);
    setDraft("");
  }, []);
  const handleCopyMessage = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toastInfo("Message copied.");
    } catch {
      toastError("Couldn’t copy message.");
    }
  }, [toastError, toastInfo]);
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(messageId);
      if (editingMessage?.id === messageId) cancelEditingMessage();
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Couldn’t delete message.");
    }
  }, [cancelEditingMessage, deleteMessage, editingMessage?.id, toastError]);
  const openExpenseDetail = useCallback((expenseId: number) => {
    openPanel({ type: "expense", id: String(expenseId) });
  }, [openPanel]);
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
      if (message.type !== "user") {
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

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    chatSidebarDevInstanceCounter += 1;
    devInstanceIdRef.current = chatSidebarDevInstanceCounter;
    console.log("[chat-render] mounted", {
      eventId,
      instanceId: devInstanceIdRef.current,
    });
    return () => {
      console.log("[chat-render] unmounted", {
        eventId,
        instanceId: devInstanceIdRef.current,
      });
    };
  }, [eventId]);

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || !eventId) return;
    markPlanSwitchPerf(eventId, "chat first render commit", {
      instanceId: devInstanceIdRef.current,
    });
  }, [eventId]);

  useLayoutEffect(() => {
    if (!import.meta.env.DEV || !eventId || historyLoading) return;
    const rafId = window.requestAnimationFrame(() => {
      markPlanSwitchPerf(eventId, "message list render complete", {
        messages: messages.length,
        renderedRows: virtualRows.length,
        groups: messageGroups.length,
        instanceId: devInstanceIdRef.current,
      });
      console.log("[chat-render] message list", {
        eventId,
        instanceId: devInstanceIdRef.current,
        messages: messages.length,
        renderedRows: virtualRows.length,
        groups: messageGroups.length,
      });
      if (messages.length > 50) {
        console.warn("[chat-render] message list exceeds 50 items; verify virtualization/render cost", {
          eventId,
          messages: messages.length,
          renderedRows: virtualRows.length,
        });
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [eventId, historyLoading, messageGroups.length, messages.length, virtualRows.length]);

  return (
    <>
    <aside
      className={cn("pointer-events-auto relative flex h-full min-h-0 flex-col overflow-hidden bg-[hsl(var(--surface-0))]", className)}
      style={
        {
          "--chat-pattern-bg": "linear-gradient(180deg, hsl(var(--surface-0)) 0%, hsl(var(--surface-0)) 100%)",
        } as CSSProperties
      }
    >
      <header className={cn(
        "sticky top-0 z-10 shrink-0 border-b border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] transition-[padding,box-shadow,background-color] duration-200 ease-out",
        isMobile
          ? cn(
              "px-3",
              isMobileHeaderCondensed ? "py-1 shadow-[0_1px_0_hsl(var(--border-subtle))]" : "py-1.5",
            )
          : "px-6 py-4",
      )}>
        <div className={cn("flex justify-between gap-4", isMobile ? "items-center" : "items-start")}>
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
              <span className={cn(
                "block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground",
                isMobile && "hidden",
              )}>
                Chat
              </span>
              <span className={cn(
                "block truncate font-semibold tracking-tight transition-[font-size,line-height] duration-200 ease-out",
                isMobile
                  ? (isMobileHeaderCondensed ? "text-base leading-5" : "text-[1.05rem] leading-6")
                  : "mt-1 text-xl",
              )}>
                {eventName || "Current plan"}
              </span>
            </button>
          </div>
          <div className={cn("flex items-center", isMobile ? "gap-2.5" : "gap-2")}>
            <div className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] text-[10px] text-muted-foreground transition-[padding,min-height] duration-200 ease-out",
              isMobile ? (isMobileHeaderCondensed ? "min-h-6 px-2 py-0" : "min-h-7 px-2 py-0.5") : "px-2 py-1",
            )}>
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${liveLabel.cls}`} />
              {liveLabel.text}
            </div>
          </div>
        </div>
        <div className={cn(
          "w-full items-center text-muted-foreground transition-[margin,opacity] duration-200 ease-out",
          isMobile
            ? cn(
                "flex overflow-hidden whitespace-nowrap text-[11px] leading-4.5",
                isMobileHeaderCondensed ? "mt-0.5" : "mt-1",
              )
            : "mt-3 flex flex-wrap gap-x-1 gap-y-1.5 text-sm",
        )}>
          <button
            type="button"
            aria-label="Open plan location details"
            onClick={openPlanDetails}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isMobile ? "min-w-0 flex-1 px-0 py-0 text-[11px]" : "px-1.5 py-1",
              isPlanDetailsOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MapPin className={cn("h-3.5 w-3.5", isMobile && "h-3 w-3 shrink-0")} />
            <span className={cn("truncate", isMobile && "text-foreground/80")}>{locationLabel}</span>
          </button>
          {isMobileHeaderCondensed ? null : (
            <>
          <span className="shrink-0 text-muted-foreground/45">•</span>
          {!isMobile ? (
            <button
              type="button"
              aria-label="Open crew drawer"
              onClick={openCrew}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isMobile ? "min-h-11 px-2.5 py-2" : "px-1.5 py-1",
                isCrewOpen
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{peopleLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              aria-label="Open crew drawer"
              onClick={openCrew}
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0 text-[11px] transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isCrewOpen
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="h-3 w-3" />
              <span className="text-foreground/80">{peopleLabel}</span>
            </button>
          )}
            </>
          )}
          <span className="shrink-0 text-muted-foreground/45">•</span>
          <button
            type="button"
            aria-label="Open plan date details"
            onClick={openPlanDetails}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isMobile ? "shrink-0 px-1 py-0 text-[11px]" : "px-1.5 py-1",
              isPlanDetailsOpen
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Calendar className={cn("h-3.5 w-3.5", isMobile && "h-3 w-3")} />
            <span className={cn(isMobile && "text-foreground/80")}>{dateLabel}</span>
          </button>
          {!isMobile ? (
            <>
              <span className="text-muted-foreground/45">•</span>
              <button
                type="button"
                aria-label="Open photos panel"
                onClick={openPhotos}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isPhotosOpen
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Photos</span>
              </button>
              <span className="text-muted-foreground/45">•</span>
              <button
                type="button"
                aria-label="Open shared costs drawer"
                onClick={openExpenses}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md text-sm transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "px-1.5 py-1",
                  isExpensesOpen
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span className={cn("font-medium", isExpensesOpen ? "text-foreground" : "")}>{sharedLabel}</span>
              </button>
              <span className="text-muted-foreground/45">•</span>
              <span className="inline-flex items-center gap-1.5 px-1.5 py-1 text-sm text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" />
                <span>{expensesLabel}</span>
              </span>
            </>
          ) : isMobileHeaderCondensed ? null : (
            <>
              <span className="shrink-0 text-muted-foreground/45">•</span>
              <button
                type="button"
                aria-label="Open shared costs drawer"
                onClick={openExpenses}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0 text-[10px] transition active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isExpensesOpen
                    ? "text-foreground"
                    : "text-muted-foreground/80 hover:text-foreground",
                )}
              >
                <CreditCard className="h-2.5 w-2.5" />
                <span className={cn("font-medium", isExpensesOpen ? "text-foreground/85" : "")}>{sharedLabel}</span>
              </button>
              <span className="shrink-0 text-muted-foreground/45">•</span>
              <span className="inline-flex shrink-0 items-center gap-1 px-1 py-0 text-[10px] text-muted-foreground/80">
                <Receipt className="h-2.5 w-2.5" />
                <span>{expensesLabel}</span>
              </span>
            </>
          )}
        </div>
      </header>

      <div
        ref={listRef}
        className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[hsl(var(--surface-0))]"
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
          scrollPaddingBottom: isMobile ? "1rem" : "1.5rem",
          background: `${chatPatternStyle.backgroundImage} 0 0 / 184px 184px repeat, var(--chat-pattern-bg)`,
        }}
      >
        <div
          className={cn(
            "mx-auto flex min-h-full w-full",
            isMobile ? (hasTopHistoryAction ? "pt-1.5 pb-1.5" : "pt-0 pb-1.5") : "py-4 sm:py-6",
            isAnyPanelOpen
              ? (isMobile ? "max-w-full px-2" : "max-w-3xl px-6 sm:px-8 lg:px-10")
              : (isMobile ? "max-w-full px-2" : "max-w-[1040px] px-4 sm:px-8"),
          )}
        >
        <div className={cn("flex min-h-full w-full flex-col justify-end", isMobile ? "gap-0.5" : "gap-2")}>
        {hasMoreHistory ? (
          <div className="flex justify-center pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn("rounded-full px-3 text-xs text-muted-foreground", isMobile ? "h-9" : "h-7")}
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
            <div className="space-y-1.5 text-muted-foreground">
              <MessageCircle className="h-5 w-5 mx-auto opacity-40" />
              <p className="text-sm font-medium">No messages yet</p>
              <p className="text-xs opacity-70">
                Start the conversation — share details, ask who&apos;s coming, or add the first expense.
              </p>
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
                const expenseMeta = toExpenseMetadata(msg.metadata ?? null);
                const settlementMeta = toSettlementMetadata(msg.metadata ?? null);
                const settlementPaymentMeta = toSettlementPaymentMetadata(msg.metadata ?? null);
                const pollMeta = toPollMetadata(msg.metadata ?? null);
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
                const isSystemMessage = msg.type === "system";
                const senderName = msg.user?.name || (isSystemMessage ? SYSTEM_USER_NAME : "Unknown user");
                const senderInitials = isSystemMessage ? "S" : getInitials(senderName);
                return (
                  <div
                    key={group.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className={cn(isMobile ? "mb-4" : "mb-5")}>
                      {showDateSeparator ? (
                        <div className="relative z-10 my-2 flex justify-center">
                          <span className={cn(
                            "self-center rounded-full border border-border/70 bg-[hsl(var(--surface-2))] text-muted-foreground shadow-sm",
                            isMobile ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs",
                          )}>
                            {formatDateSeparator(msg.createdAt)}
                          </span>
                        </div>
                      ) : null}
                      <div className={cn("flex justify-start", isMobile && virtualRow.index === 0 && !showDateSeparator ? "mt-0.5" : "mt-2")}>
                        <div className={cn("mr-2 flex flex-col items-center pt-0.5", isMobile ? "w-8" : "w-10")}>
                          <span className={cn(
                            "grid place-items-center rounded-full border border-border/70 bg-muted font-semibold text-muted-foreground",
                            isMobile ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]",
                          )}>
                            {senderInitials}
                          </span>
                        </div>
                        <div className={cn(isMobile ? "max-w-[90%]" : "max-w-[84%] sm:max-w-[78%]")}>
                          <div className={cn("mb-1 px-1 text-muted-foreground", isMobile ? "text-[10px]" : "text-[11px]")}>
                            <span className="font-semibold text-foreground/90">{senderName}</span>
                            {!isSystemMessage ? (
                              <span className="ml-1 rounded-full border border-border/60 bg-card px-1.5 py-0 text-[9px] uppercase tracking-wide">Poll</span>
                            ) : null}
                            {!isMobile ? <span className="px-1 text-muted-foreground/70">·</span> : null}
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
                              actorName={expenseMeta.actorName}
                              resolutionMode={expenseMeta.resolutionMode}
                              settlementId={expenseMeta.linkedSettlementRoundId}
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
                          ) : pollMeta ? (
                            <PollMessage pollId={pollMeta.pollId} />
                          ) : settlementPaymentMeta ? (
                            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
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
                            <div className="mx-auto max-w-[560px] rounded-2xl border border-border/70 bg-[hsl(var(--surface-2))] px-3 py-2 text-xs text-muted-foreground dark:bg-[hsl(var(--surface-2))]">
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
      const senderAvatar = resolveAssetUrl(firstMsg.user?.avatarUrl ?? senderFromMember?.avatarUrl ?? null);
              const mine = senderId !== SYSTEM_USER_ID
                && (senderId === String(currentUser?.id ?? "") || firstMsg.user?.name === currentUser?.username);
              const latestMessage = group.messages[group.messages.length - 1];
              const groupReactionSummary = summarizeMessageReactions(
                group.messages.flatMap((message) => message.reactions ?? []),
              );
              const hasGroupReactions = groupReactionSummary.length > 0;
              const latestMessageAttachment = toAttachmentMetadata(latestMessage.metadata ?? null);
              const canEditLatestMessage = mine && latestMessage.type === "user" && !latestMessageAttachment;
              const canDeleteLatestMessage = mine && latestMessage.type === "user";
              const groupHasOnlyImageAttachments = group.messages.every((message) => {
                const attachment = toAttachmentMetadata(message.metadata ?? null);
                const replyTo = toReplyToMetadata(message.metadata ?? null);
                const hasVisibleText = !attachment || message.text.trim() !== attachment.fileName;
                return attachment?.kind === "image" && !replyTo && !hasVisibleText;
              });

              return (
                <div
                  key={group.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div className={cn(isMobile ? "mb-3" : "mb-5")}>
                    {showDateSeparator ? (
                      <div className={cn("flex justify-center", isMobile ? "my-1.5" : "my-2")}>
                        <span className={cn("self-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground", isMobile ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs")}>
                          {formatDateSeparator(firstMsg.createdAt)}
                        </span>
                      </div>
                    ) : null}
                    <div className={cn("flex items-start", isMobile ? (virtualRow.index === 0 && !showDateSeparator ? "mt-0.5" : "mt-1") : "mt-4", mine ? "justify-end" : "justify-start gap-2 sm:gap-3")}>
                      {!mine ? (
                        <div className={cn("shrink-0 pt-0.5", isMobile ? "w-[1.375rem]" : "w-8")}>
                          {senderAvatar ? (
                            <img src={senderAvatar} alt="" className={cn("rounded-full border border-border/70 object-cover", isMobile ? "h-5 w-5" : "h-7 w-7")} />
                          ) : (
                            <span className={cn("grid place-items-center rounded-full border border-border/70 bg-card font-semibold text-muted-foreground", isMobile ? "h-5 w-5 text-[8px]" : "h-7 w-7 text-[10px]")}>
                              {getInitials(senderName)}
                            </span>
                          )}
                        </div>
                      ) : null}
                      <div className={cn("flex flex-col", mine ? (isMobile ? "max-w-[88%] items-end" : "max-w-[88%] items-end sm:max-w-[80%]") : (isMobile ? "max-w-[88%] items-start" : "max-w-[88%] items-start sm:max-w-[80%]"))}>
                        <div className={cn("mb-0.5 px-1 text-muted-foreground", isMobile ? "text-[10px]" : "text-xs", mine ? "text-right" : "")}>
                          <span className="font-medium text-foreground">{mine ? "You" : senderName}</span>
                          <span className="px-1.5 text-muted-foreground/70">·</span>
                          <span>{formatMessageTime(firstMsg.createdAt)}</span>
                        </div>
                        <div className={cn("group/bubble inline-flex flex-col", mine ? "items-end" : "items-start")}>
                          <div className={cn("flex items-center gap-2", mine ? "flex-row-reverse" : "flex-row")}>
                            <div
                              className={cn(
                                "rounded-2xl text-sm leading-snug shadow-sm",
                                groupHasOnlyImageAttachments
                                  ? "bg-transparent p-0 shadow-none"
                                  : isMobile
                                  ? "px-3 py-2.5"
                                  : "px-4 py-2",
                                groupHasOnlyImageAttachments
                                  ? "border-0 text-foreground"
                                  : mine
                                  ? "bg-primary text-slate-900"
                                  : "border border-border/70 bg-background/95 text-foreground dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/96",
                              )}
                            >
                              <div className="flex flex-col gap-1.5">
                                {group.messages.map((msg, msgIndexInGroup) => {
                                  const replyTo = toReplyToMetadata(msg.metadata ?? null);
                                  const attachment = toAttachmentMetadata(msg.metadata ?? null);
                                  const attachmentUrl = resolveAssetUrl(attachment?.url ?? null);
                                  const showMessageText = !attachment || msg.text.trim() !== attachment.fileName;
                                  return (
                                    <div
                                      key={msg.id}
                                      className={cn(
                                        "whitespace-pre-wrap break-words leading-snug",
                                        msgIndexInGroup > 0 ? (isMobile ? "border-t border-border/30 pt-1.5" : "border-t border-border/40 pt-1") : "",
                                      )}
                                    >
                                      {replyTo ? (
                                        <div className="mb-1.5 flex gap-1.5 rounded-md bg-black/5 px-2 py-1.5 dark:bg-white/10">
                                          <div className="w-0.5 shrink-0 rounded-full bg-primary/70" />
                                          <div className="min-w-0">
                                            <p className="text-[10px] font-semibold text-primary/80">
                                              {replyTo.senderName}
                                            </p>
                                            <p className="truncate text-[11px] text-muted-foreground">
                                              {replyTo.text}
                                            </p>
                                          </div>
                                        </div>
                                      ) : null}
                                      {attachment ? (
                                        <div
                                          className={cn(
                                            "mb-1.5 overflow-hidden text-foreground",
                                            attachment.kind === "image"
                                              ? "rounded-[18px] bg-transparent"
                                              : "rounded-xl border border-border/60 bg-background/70",
                                          )}
                                        >
                                          {attachment.kind === "image" && attachmentUrl ? (
                                            <button
                                              type="button"
                                              onClick={() => setViewerImage({ src: attachmentUrl, alt: attachment.fileName })}
                                              className="group/image relative block max-w-[140px] cursor-zoom-in overflow-hidden rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-[180px]"
                                              aria-label={`Open image ${attachment.fileName}`}
                                            >
                                              <img
                                                src={attachmentUrl}
                                                alt={attachment.fileName}
                                                className="max-h-[180px] h-auto w-auto max-w-full object-cover transition duration-200 group-hover/image:scale-[1.01] group-hover/image:opacity-95"
                                              />
                                              <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover/image:bg-black/5 dark:group-hover/image:bg-black/10" />
                                            </button>
                                          ) : (
                                            <a
                                              href={attachmentUrl ?? undefined}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50"
                                            >
                                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/50 text-muted-foreground">
                                                <FileText className="h-4 w-4" />
                                              </div>
                                              <div className="min-w-0">
                                                <p className="truncate text-xs font-medium text-foreground">
                                                  {attachment.fileName}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">
                                                  {formatAttachmentSize(attachment.size)}
                                                </p>
                                              </div>
                                            </a>
                                          )}
                                        </div>
                                      ) : null}
                                      {showMessageText ? <p>{msg.text}</p> : null}
                                      {msg.editedAt && msg.status !== "sending" && msg.status !== "failed" ? (
                                        <p className={cn("mt-1 text-[10px]", mine ? "text-slate-800/70" : "text-muted-foreground")}>
                                          edited
                                        </p>
                                      ) : null}
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
                                  );
                                })}
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
                                  setEditingMessage(null);
                                  setReplyingTo({
                                    id: latestMessage.id,
                                    senderName: mine ? "You" : senderName,
                                    text: latestMessage.text.trim().slice(0, 60),
                                  });
                                  window.requestAnimationFrame(() => {
                                    inputRef.current?.focus();
                                  });
                                }}
                              >
                                <Reply className="h-3.5 w-3.5" />
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label="More message actions"
                                    className={`${circularActionButtonClass()} inline-flex h-7 w-7 items-center justify-center`}
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align={mine ? "end" : "start"} className="w-40">
                                  <DropdownMenuItem onClick={() => { void handleCopyMessage(latestMessage.text); }}>
                                    <Copy className="h-4 w-4" />
                                    Copy text
                                  </DropdownMenuItem>
                                  {canEditLatestMessage ? (
                                    <DropdownMenuItem onClick={() => startEditingMessage({ id: latestMessage.id, text: latestMessage.text })}>
                                      <Pencil className="h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                  ) : null}
                                  {canDeleteLatestMessage ? (
                                    <DropdownMenuItem
                                      onClick={() => { void handleDeleteMessage(latestMessage.id); }}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  ) : null}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
          className={cn(
            "absolute left-1/2 z-20 -translate-x-1/2 rounded-full border border-border/60 bg-background/90 text-foreground shadow-md backdrop-blur-md transition hover:bg-background",
            isMobile ? "bottom-[5.25rem] px-3 py-1 text-[12px]" : "bottom-24 px-4 py-2 text-sm",
          )}
        >
          {unseenCount > 1 ? `${unseenCount} new messages ↓` : "New messages ↓"}
        </button>
      ) : null}

      <div className={cn(
        "shrink-0 border-t border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]",
        isMobile
          ? "px-2 py-0.5 pb-[max(env(safe-area-inset-bottom),0.35rem)] shadow-[0_-10px_24px_rgba(0,0,0,0.24)]"
          : "px-6 py-1",
      )}>
        {expenseSuggestion ? (
          <div className={cn("mb-2 flex gap-2", isMobile ? "flex-col items-start gap-1.5" : "items-center justify-between")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs font-medium text-foreground">
                Detected expense
              </span>
              {expenseSuggestion.amount ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  €{expenseSuggestion.amount.toFixed(2)}
                </span>
              ) : null}
              {expenseSuggestion.paidBy ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  paid by {expenseSuggestion.paidBy}
                </span>
              ) : null}
              {!isMobile && expenseSuggestion.splitCount ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  split {expenseSuggestion.splitCount}
                </span>
              ) : null}
              {!isMobile && expenseSuggestion.description ? (
                <span className="rounded-full border border-border/70 bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
                  {expenseSuggestion.description}
                </span>
              ) : null}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn("shrink-0", isMobile ? "h-8 rounded-full px-3" : "h-7")}
              onClick={openCreateExpenseFromSuggestion}
            >
              Add Expense
            </Button>
          </div>
        ) : null}
        <div className={cn("min-h-4", isMobile ? "mb-1.5" : "mb-1")}>
          {visibleTypingUsers.length > 0 ? (
            <div className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/45 text-muted-foreground",
              isMobile ? "px-2 py-0.5 text-[10px]" : "px-3 py-1.5 text-xs",
            )}>
              <span>Typing</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
              </span>
            </div>
          ) : null}
        </div>
        {!isLocked && normalizedPlanStatus === "settled" ? (
          <div className={cn(
            "mb-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200",
            isMobile && "mb-1.5 px-2.5 py-1.5 text-[11px] leading-4",
          )}>
            Plan completed 🎉 All balances are settled. Chat stays open until {chatClosesLabel ?? "soon"}.
          </div>
        ) : null}
        <div className={cn("flex items-end gap-2", isMobile ? "gap-2 pb-0" : "items-center")}>
          {isLocked ? (
            <div className={cn(
              "absolute inset-x-0 -top-[4.1rem] z-10 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 text-center shadow-sm backdrop-blur",
              isMobile && "px-3 py-2.5",
            )}>
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-muted-foreground">
                  {normalizedPlanStatus === "archived"
                    ? "This plan is archived"
                    : normalizedPlanStatus === "settled"
                      ? "This plan is closed"
                      : normalizedPlanStatus === "closed"
                        ? "This plan is closed"
                        : "This plan has ended"}
                  {settledAt
                    ? ` · ${formatFullDate(settledAt)}`
                    : ""}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {normalizedPlanStatus === "archived"
                  ? "Chat history is preserved. The wrap-up window is over and the plan is now fully read-only."
                  : "Chat history is preserved. This plan is closed. Settlement can still be completed."}
              </p>
            </div>
          ) : null}
            <div
              className={cn(
                "flex flex-1 flex-col rounded-[1.35rem] border border-border/70 bg-background",
                isMobile ? "min-h-[2.75rem] shadow-sm" : "min-h-10",
                isLocked && "bg-muted/30 opacity-90",
              )}
            >
            {replyingTo ? (
              <div className="flex items-center gap-2 rounded-t-[15px] border-x border-t border-border/60 bg-muted/40 px-3 py-2">
                <div className="w-0.5 self-stretch rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-primary">
                    Replying to {replyingTo.senderName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {replyingTo.text}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="shrink-0 rounded-full p-1 hover:bg-muted"
                  aria-label="Cancel reply"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : null}
            {editingMessage ? (
              <div className="flex items-center gap-2 border-x border-t border-border/60 bg-muted/35 px-3 py-2">
                <div className="w-0.5 self-stretch rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-primary">
                    Editing message
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {editingMessage.originalText}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelEditingMessage}
                  className="shrink-0 rounded-full p-1 hover:bg-muted"
                  aria-label="Cancel edit"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : null}
            {pendingAttachment ? (
              <div className="flex items-center gap-2 border-x border-t border-border/60 bg-muted/30 px-3 py-2">
                <div className="w-0.5 self-stretch rounded-full bg-primary" />
                {pendingAttachment.kind === "image" && pendingAttachment.previewUrl ? (
                  <img
                    src={pendingAttachment.previewUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-md border border-border/70 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {pendingAttachment.file.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {pendingAttachment.kind === "image" ? "Image" : "File"} · {pendingAttachmentSizeLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearPendingAttachment}
                  className="shrink-0 rounded-full p-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
                  aria-label="Remove attachment"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : null}
              <div
              className={cn(
                "flex items-center gap-2",
                isMobile ? "max-h-[132px] px-2.5 py-1.5" : "max-h-[132px] px-4 py-1.5",
              )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  inputRef.current?.focus();
                  debugFocusBlock();
                }}
            >
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <Popover open={isAttachmentMenuOpen} onOpenChange={setIsAttachmentMenuOpen}>
                    <PopoverTrigger asChild>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
                            isMobile ? "h-11 w-11" : "h-8 w-8",
                          )}
                          aria-label="Add attachment"
                          disabled={!hasEventId || isLocked}
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      side="top"
                      sideOffset={8}
                      className="w-44 rounded-2xl border-border/70 p-1"
                      onOpenAutoFocus={(event) => event.preventDefault()}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        onClick={() => selectAttachmentKind("image")}
                      >
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <span>Upload image</span>
                      </button>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                        onClick={() => selectAttachmentKind("file")}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>Upload file</span>
                      </button>
                    </PopoverContent>
                  </Popover>
                  <TooltipContent>Add attachment</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                tabIndex={-1}
                onChange={handleImageInputChange}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept={FILE_ATTACHMENT_ACCEPT}
                className="hidden"
                tabIndex={-1}
                onChange={handleFileInputChange}
              />
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => handleDraftChange(e.target.value)}
                onBlur={() => emitTypingStop()}
                placeholder={isLocked ? lockedComposerPlaceholder : "Message…"}
                className={cn(
                  "pointer-events-auto w-full resize-none overflow-y-auto bg-transparent text-[16px] leading-normal text-foreground caret-primary outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/70",
                  isMobile ? "min-h-[28px] max-h-[104px] py-1 leading-[1.4]" : "min-h-[20px] max-h-[104px] py-0.5 md:text-sm",
                )}
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
          </div>
            <Button
              type="button"
              size="icon"
              className={cn(
                "shrink-0 rounded-full bg-primary text-slate-900 hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground",
                isMobile ? "h-11 w-11" : "h-10 w-10",
              )}
              onClick={() => void handleSubmit()}
              disabled={isLocked || sending || (!draft.trim() && !pendingAttachment) || !eventId}
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
      </div>
    </aside>
    <Dialog open={isImageViewerOpen} onOpenChange={(open) => { if (!open) setViewerImage(null); }}>
      <DialogContent className="w-auto max-w-[92vw] border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
        <DialogTitle className="sr-only">
          Chat image viewer
        </DialogTitle>
        <DialogDescription className="sr-only">
          Enlarged view of the selected chat image.
        </DialogDescription>
        {viewerImage ? (
          <div className="relative flex items-center justify-center">
            <DialogClose
              className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg transition hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              aria-label="Close image viewer"
            >
              <X className="h-5 w-5" />
            </DialogClose>
            <img
              src={viewerImage.src}
              alt={viewerImage.alt}
              className="max-h-[88vh] w-auto max-w-[92vw] rounded-2xl object-contain shadow-[0_18px_60px_rgba(0,0,0,0.38)]"
            />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}
