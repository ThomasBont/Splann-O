import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageCircle } from "lucide-react";
import { InlineQueryError, SkeletonLine } from "@/components/ui/load-states";
import { useEventChat } from "@/hooks/use-event-chat";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventMembers } from "@/hooks/use-participants";

type ChatSidebarProps = {
  eventId: number | null;
  eventName?: string | null;
  currentUser?: { id?: number | null; username?: string | null; avatarUrl?: string | null } | null;
  enabled?: boolean;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatSidebar({ eventId, eventName, currentUser, enabled = true }: ChatSidebarProps) {
  const { toastError } = useAppToast();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const {
    messages,
    historyLoading,
    historyError,
    connectionStatus,
    sendMessage,
    retry,
  } = useEventChat(eventId, enabled && !!eventId);
  const membersQuery = useEventMembers(eventId);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (!isNearBottom) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isNearBottom]);

  const liveLabel = useMemo(() => {
    if (connectionStatus === "connected") return { text: "Live", cls: "bg-emerald-500" };
    if (connectionStatus === "reconnecting" || connectionStatus === "connecting") return { text: "Reconnecting…", cls: "bg-amber-500" };
    return { text: "Offline", cls: "bg-slate-400" };
  }, [connectionStatus]);

  const handleSubmit = async () => {
    const text = draft.trim();
    if (!text || !eventId || sending) return;
    setSending(true);
    const ok = await sendMessage(text, {
      id: currentUser?.id ?? null,
      name: currentUser?.username ?? "You",
      avatarUrl: currentUser?.avatarUrl ?? null,
    });
    setSending(false);
    if (!ok) {
      toastError("Couldn’t send message. Try again.");
      return;
    }
    setDraft("");
  };

  return (
    <aside className="h-full min-h-[380px] rounded-lg border border-slate-200 bg-white flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">Chat</p>
            <p className="text-xs text-slate-500">
              {eventName ? `${eventName} room` : "Event room"}
              {membersQuery.data ? ` · ${membersQuery.data.length} participants` : ""}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${liveLabel.cls}`} />
            {liveLabel.text}
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2 bg-slate-50"
        onScroll={(e) => {
          const el = e.currentTarget;
          const delta = el.scrollHeight - (el.scrollTop + el.clientHeight);
          setIsNearBottom(delta < 64);
        }}
      >
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
            <div className="space-y-1 text-slate-500">
              <MessageCircle className="h-4 w-4 mx-auto" />
              <p className="text-sm">No messages yet.</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === "system") {
              return (
                <div key={msg.id} className="flex justify-center">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-500 italic">
                    {msg.text}
                  </span>
                </div>
              );
            }
            const mine = String(msg.user?.id ?? "") === String(currentUser?.id ?? "") || msg.user?.name === currentUser?.username;
            return (
              <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-white border border-slate-200 text-slate-800"}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/80" : "text-slate-500"}`}>
                    {formatMessageTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message the event room…"
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={sending || !draft.trim() || !eventId}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>
    </aside>
  );
}
