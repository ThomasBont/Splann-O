import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { BarbecueListItem } from "@/hooks/use-bbq-data";
import { getEventChatWsUrl } from "@/lib/network";

export type PlanActivityItem = {
  id: number;
  eventId: number;
  type: string;
  actorUserId: number | null;
  actorName: string | null;
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string | null;
};

type PlanActivityResponse = {
  items: PlanActivityItem[];
  unreadCount: number;
};

export function usePlanActivity(eventId: number | null, enabled = true) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<PlanActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const patchSidebarUnread = useCallback((targetEventId: number, unread: number) => {
    queryClient.setQueryData<BarbecueListItem[]>(["/api/barbecues"], (prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev.map((plan) => (
        Number(plan.id) === targetEventId ? { ...plan, unreadCount: Math.max(0, Math.trunc(unread)) } : plan
      ));
    });
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !eventId) {
      setItems([]);
      setUnreadCount(0);
      setError(null);
      setLoading(false);
      seenIdsRef.current = new Set();
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/plans/${eventId}/activity?limit=50`, { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to load activity");
        const response = Array.isArray(body)
          ? ({ items: body as PlanActivityItem[], unreadCount: 0 } satisfies PlanActivityResponse)
          : (body as PlanActivityResponse);
        const rows = Array.isArray(response.items) ? response.items : [];
        const unread = Number.isFinite(Number(response.unreadCount)) ? Number(response.unreadCount) : 0;
        if (cancelled) return;
        seenIdsRef.current = new Set(rows.map((row) => row.id));
        setItems(rows);
        setUnreadCount(unread);
        patchSidebarUnread(eventId, unread);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load activity");
        setItems([]);
        setUnreadCount(0);
        patchSidebarUnread(eventId, 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled, eventId]);

  useEffect(() => {
    if (!enabled || !eventId) return;
    const ws = new WebSocket(getEventChatWsUrl(eventId));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "event:subscribe", eventId }));
    };
    ws.onmessage = (ev) => {
      let payload: { type?: string; activity?: PlanActivityItem; eventId?: number } | null = null;
      try {
        payload = JSON.parse(ev.data as string);
      } catch {
        return;
      }
      if (payload?.type !== "PLAN_ACTIVITY_CREATED" || !payload.activity) return;
      const next = payload.activity;
      if (seenIdsRef.current.has(next.id)) return;
      seenIdsRef.current.add(next.id);
      setItems((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 50));
      setUnreadCount((prev) => {
        const nextUnread = prev + 1;
        patchSidebarUnread(eventId, nextUnread);
        return nextUnread;
      });
      setHighlightedId(next.id);
      window.setTimeout(() => {
        setHighlightedId((current) => (current === next.id ? null : current));
      }, 800);
    };
    return () => {
      ws.close();
    };
  }, [enabled, eventId]);

  const markAllAsRead = useCallback(async () => {
    if (!enabled || !eventId) return;
    setUnreadCount(0);
    patchSidebarUnread(eventId, 0);
    await fetch(`/api/plans/${eventId}/activity/read`, {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    const res = await fetch(`/api/plans/${eventId}/activity?limit=50`, { credentials: "include" });
    const body = await res.json().catch(() => ({}));
    const response = Array.isArray(body)
      ? ({ items: body as PlanActivityItem[], unreadCount: 0 } satisfies PlanActivityResponse)
      : (body as PlanActivityResponse);
    const unread = Number.isFinite(Number(response.unreadCount)) ? Number(response.unreadCount) : 0;
    setUnreadCount(unread);
    patchSidebarUnread(eventId, unread);
  }, [enabled, eventId, patchSidebarUnread]);

  const latestItems = useMemo(() => items.slice(0, 3), [items]);
  return { items, latestItems, unreadCount, loading, error, highlightedId, markAllAsRead };
}
