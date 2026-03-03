import { useEffect, useMemo, useRef, useState } from "react";
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

export function usePlanActivity(eventId: number | null, enabled = true) {
  const [items, setItems] = useState<PlanActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || !eventId) {
      setItems([]);
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
        const res = await fetch(`/api/plans/${eventId}/activity?limit=10`, { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to load activity");
        const rows = Array.isArray((body as { items?: unknown }).items)
          ? ((body as { items: PlanActivityItem[] }).items)
          : [];
        if (cancelled) return;
        seenIdsRef.current = new Set(rows.map((row) => row.id));
        setItems(rows);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load activity");
        setItems([]);
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
      setItems((prev) => [next, ...prev.filter((item) => item.id !== next.id)].slice(0, 10));
      setHighlightedId(next.id);
      window.setTimeout(() => {
        setHighlightedId((current) => (current === next.id ? null : current));
      }, 800);
    };
    return () => {
      ws.close();
    };
  }, [enabled, eventId]);

  const latestItems = useMemo(() => items.slice(0, 3), [items]);
  return { items, latestItems, loading, error, highlightedId };
}
