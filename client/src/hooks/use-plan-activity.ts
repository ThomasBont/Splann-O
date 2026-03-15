import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BarbecueListItem } from "@/hooks/use-bbq-data";
import { apiRequest } from "@/lib/api";
import { useEventRealtime } from "@/lib/event-realtime";
import { queryKeys } from "@/lib/query-keys";

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

const EMPTY_ACTIVITY_ITEMS: PlanActivityItem[] = [];

function dedupeActivityItems(items: PlanActivityItem[]) {
  const byId = new Map<number, PlanActivityItem>();
  for (const item of items) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.id - a.id;
  });
}

function planActivityQueryKey(eventId: number | null) {
  return queryKeys.plans.activity(eventId ?? 0);
}

async function fetchPlanActivity(eventId: number): Promise<PlanActivityResponse> {
  const body = await apiRequest<PlanActivityResponse | PlanActivityItem[]>(`/api/plans/${eventId}/activity?limit=50`);
  if (Array.isArray(body)) {
    return { items: body as PlanActivityItem[], unreadCount: 0 };
  }
  return {
    items: dedupeActivityItems(Array.isArray(body.items) ? body.items : []),
    unreadCount: Number.isFinite(Number(body.unreadCount)) ? Number(body.unreadCount) : 0,
  };
}

export function usePlanActivity(eventId: number | null, enabled = true) {
  const queryClient = useQueryClient();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());
  const highlightedTimerRef = useRef<number | null>(null);
  const lastConnectedVersionRef = useRef(0);
  const realtime = useEventRealtime(eventId, enabled, (rawPayload) => {
    const payload = rawPayload as { type?: string; activity?: PlanActivityItem; eventId?: number } | null;
    if (payload?.type !== "PLAN_ACTIVITY_CREATED" || !payload.activity || payload.eventId !== eventId) return;
    const next = payload.activity;
    if (seenIdsRef.current.has(next.id)) return;
    seenIdsRef.current.add(next.id);
    queryClient.setQueryData<PlanActivityResponse>(planActivityQueryKey(eventId), (prev) => {
      const currentItems = Array.isArray(prev?.items) ? prev.items : [];
      const currentUnread = Number.isFinite(Number(prev?.unreadCount)) ? Number(prev?.unreadCount) : 0;
      const items = dedupeActivityItems([next, ...currentItems]).slice(0, 50);
      const unreadCount = currentUnread + 1;
      patchSidebarUnread(eventId!, unreadCount);
      return { items, unreadCount };
    });
    setHighlightedId(next.id);
    if (highlightedTimerRef.current != null) window.clearTimeout(highlightedTimerRef.current);
    highlightedTimerRef.current = window.setTimeout(() => {
      setHighlightedId((current) => (current === next.id ? null : current));
    }, 800);
  });
  const patchSidebarUnread = useCallback((targetEventId: number, unread: number) => {
    queryClient.setQueryData<BarbecueListItem[]>(queryKeys.plans.list(), (prev) => {
      if (!Array.isArray(prev)) return prev;
      const normalizedUnread = Math.max(0, Math.trunc(unread));
      let changed = false;
      const next = prev.map((plan) => {
        if (Number(plan.id) !== targetEventId) return plan;
        const currentUnread = Math.max(0, Math.trunc(Number(plan.unreadCount ?? 0)));
        if (currentUnread === normalizedUnread) return plan;
        changed = true;
        return { ...plan, unreadCount: normalizedUnread };
      });
      return changed ? next : prev;
    });
  }, [queryClient]);

  const activityQuery = useQuery({
    queryKey: planActivityQueryKey(eventId),
    queryFn: () => fetchPlanActivity(eventId!),
    enabled: enabled && !!eventId,
  });

  const items = activityQuery.data?.items ?? EMPTY_ACTIVITY_ITEMS;
  const unreadCount = activityQuery.data?.unreadCount ?? 0;
  const loading = activityQuery.isLoading;
  const error = activityQuery.isError ? (activityQuery.error instanceof Error ? activityQuery.error.message : "Failed to load activity") : null;

  useEffect(() => {
    if (!enabled || !eventId) {
      seenIdsRef.current = new Set();
      lastConnectedVersionRef.current = 0;
      return;
    }
    seenIdsRef.current = new Set(items.map((row) => row.id));
  }, [enabled, eventId, items]);

  useEffect(() => {
    if (!enabled || !eventId || realtime.connectedVersion <= 0) return;
    if (lastConnectedVersionRef.current === 0) {
      lastConnectedVersionRef.current = realtime.connectedVersion;
      return;
    }
    if (lastConnectedVersionRef.current === realtime.connectedVersion) return;
    lastConnectedVersionRef.current = realtime.connectedVersion;
    void queryClient.invalidateQueries({ queryKey: planActivityQueryKey(eventId) });
  }, [enabled, eventId, queryClient, realtime.connectedVersion]);

  const markAllAsRead = useCallback(async () => {
    if (!enabled || !eventId) return;
    queryClient.setQueryData<PlanActivityResponse>(planActivityQueryKey(eventId), (prev) => ({
      items: prev?.items ?? [],
      unreadCount: 0,
    }));
    patchSidebarUnread(eventId, 0);
    await apiRequest(`/api/plans/${eventId}/activity/read`, {
      method: "POST",
    }).catch(() => undefined);
    await queryClient.invalidateQueries({ queryKey: planActivityQueryKey(eventId) });
  }, [enabled, eventId, patchSidebarUnread, queryClient]);

  useEffect(() => {
    return () => {
      if (highlightedTimerRef.current != null) {
        window.clearTimeout(highlightedTimerRef.current);
      }
    };
  }, []);

  const latestItems = useMemo(() => items.slice(0, 3), [items]);
  return { items, latestItems, unreadCount, loading, error, highlightedId, markAllAsRead };
}
