import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, SendHorizontal } from "lucide-react";
import { InlineQueryError, SkeletonLine } from "@/components/ui/load-states";
import { useEventChat } from "@/hooks/use-event-chat";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventMembers } from "@/hooks/use-participants";
import type { SendMessageResult } from "@/hooks/use-event-chat";

type ChatSidebarProps = {
  eventId: number | null;
  eventName?: string | null;
  currentUser?: { id?: number | null; username?: string | null; avatarUrl?: string | null } | null;
  enabled?: boolean;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getInitials(name: string) {
  const safe = name.trim();
  if (!safe) return "U";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return safe.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

export function ChatSidebar({ eventId, eventName, currentUser, enabled = true }: ChatSidebarProps) {
  const { toastError, toastInfo } = useAppToast();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingEmitTimerRef = useRef<number | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
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
    loadOlder,
    retry,
  } = useEventChat(eventId, enabled && !!eventId);
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
    if (!draft.trim() || isLocked || !eventId) return;
    if (typingEmitTimerRef.current != null) return;
    typingEmitTimerRef.current = window.setTimeout(() => {
      sendTyping({
        id: currentUser?.id ?? null,
        name: currentUser?.username ?? "Someone",
      });
      typingEmitTimerRef.current = null;
    }, 300);
    return () => {
      if (typingEmitTimerRef.current != null) {
        window.clearTimeout(typingEmitTimerRef.current);
        typingEmitTimerRef.current = null;
      }
    };
  }, [currentUser?.id, currentUser?.username, draft, eventId, isLocked, sendTyping]);

  useEffect(() => {
    return () => {
      if (typingEmitTimerRef.current != null) {
        window.clearTimeout(typingEmitTimerRef.current);
        typingEmitTimerRef.current = null;
      }
    };
  }, []);

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

  return (
    <aside className="pointer-events-auto flex h-full min-h-[380px] flex-col overflow-hidden rounded-lg border border-border/70 bg-card">
      <header className="border-b border-border/70 bg-background/70 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Plan chat</p>
            <p className="text-xs text-muted-foreground">
              {eventName ? `${eventName} room` : "Plan room"}
              {membersQuery.data ? ` · ${membersQuery.data.length} people` : ""}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-2 py-1 text-[10px] text-muted-foreground">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${liveLabel.cls}`} />
            {liveLabel.text}
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-background/40 px-3 py-3"
        onScroll={(e) => {
          const el = e.currentTarget;
          const delta = el.scrollHeight - (el.scrollTop + el.clientHeight);
          setIsNearBottom(delta < 64);
        }}
      >
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
          messages.map((msg, index) => {
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] italic text-muted-foreground">
                    {msg.text}
                  </span>
                </div>
              );
            }
            const prev = index > 0 ? messages[index - 1] : undefined;
            const next = index < messages.length - 1 ? messages[index + 1] : undefined;
            const senderId = String(msg.user?.id ?? "");
            const senderFromMember = senderId ? membersById.get(senderId) : undefined;
            const senderName = msg.user?.name || senderFromMember?.name || "Unknown user";
            const senderAvatar = msg.user?.avatarUrl ?? senderFromMember?.avatarUrl ?? null;
            const mine = String(msg.user?.id ?? "") === String(currentUser?.id ?? "") || msg.user?.name === currentUser?.username;
            const prevSenderId = prev?.type === "user" ? String(prev.user?.id ?? "") : "";
            const nextSenderId = next?.type === "user" ? String(next.user?.id ?? "") : "";
            const prevTime = prev ? new Date(prev.createdAt).getTime() : NaN;
            const nextTime = next ? new Date(next.createdAt).getTime() : NaN;
            const currentTime = new Date(msg.createdAt).getTime();
            const groupedWithPrev = !!prev && prev.type === "user" && prevSenderId === senderId
              && Number.isFinite(prevTime) && Number.isFinite(currentTime)
              && (currentTime - prevTime) < GROUP_WINDOW_MS;
            const groupedWithNext = !!next && next.type === "user" && nextSenderId === senderId
              && Number.isFinite(nextTime) && Number.isFinite(currentTime)
              && (nextTime - currentTime) < GROUP_WINDOW_MS;
            return (
              <div key={msg.id} className={`group/message flex ${mine ? "justify-end" : "justify-start"} ${groupedWithPrev ? "mt-1" : "mt-2.5"}`}>
                {!mine ? (
                  <div className="mr-2 flex w-8 flex-col items-center pt-0.5">
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
                <div className={`${mine ? "max-w-[84%] items-end" : "max-w-[82%] items-start"} flex flex-col`}>
                  {!groupedWithPrev ? (
                    <p className={`mb-1 px-1 text-[11px] ${mine ? "text-muted-foreground/80" : "text-muted-foreground"}`}>
                      {mine ? "You" : senderName}
                    </p>
                  ) : null}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${mine
                      ? "bg-[#D4A017] text-white shadow-md dark:bg-[#C99613]"
                      : "border border-border/70 bg-muted/40 text-foreground dark:bg-muted/20"}`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    {msg.status === "sending" ? (
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/80" : "text-muted-foreground"}`}>sending…</p>
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
                  {!groupedWithNext ? (
                    <p
                      className={`mt-1 px-1 text-xs opacity-60 transition-opacity md:opacity-0 md:group-hover/message:opacity-60 ${
                        mine ? "text-primary/80" : "text-muted-foreground"
                      }`}
                    >
                      {formatMessageTime(msg.createdAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border/70 bg-card p-3">
        {isLocked ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Chat closed after event. History remains visible.
          </p>
        ) : null}
        {visibleTypingUsers.length > 0 ? (
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
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
        <div className="flex items-end gap-2">
          <div
            className="min-h-[44px] max-h-[120px] flex-1 rounded-full border border-border/70 bg-background/70 px-4 py-2"
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
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message…"
              className="pointer-events-auto min-h-[28px] max-h-[104px] w-full resize-none bg-transparent text-sm text-foreground caret-primary outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:text-muted-foreground/70"
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
            className="h-10 w-10 rounded-full bg-[#D4A017] text-white hover:bg-[#BF9013] disabled:bg-muted disabled:text-muted-foreground"
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
