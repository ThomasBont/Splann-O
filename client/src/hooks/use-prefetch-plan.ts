import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchPlan } from "@/hooks/use-bbq-data";
import { fetchPlanMessages } from "@/hooks/use-event-chat";
import {
  crewQueryKey,
  expensesQueryKey,
  fetchPlanCrew,
  fetchPlanExpenses,
  messagesQueryKey,
  planQueryKey,
} from "@/hooks/use-plan-data";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

const HOVER_PREFETCH_DELAY_MS = 150;

function isFresh(dataUpdatedAt: number): boolean {
  if (!Number.isFinite(dataUpdatedAt) || dataUpdatedAt <= 0) return false;
  return (Date.now() - dataUpdatedAt) < PLAN_STALE_TIME_MS;
}

export function usePrefetchPlan() {
  const queryClient = useQueryClient();
  const timersRef = useRef<Map<number, number>>(new Map());

  const prefetchPlan = useCallback((planId: number) => {
    if (!Number.isFinite(planId) || planId <= 0) return;

    const prefetchIfStale = (queryKey: readonly unknown[], queryFn: () => Promise<unknown>) => {
      const state = queryClient.getQueryState(queryKey);
      if (state?.status === "success" && isFresh(state.dataUpdatedAt ?? 0)) return;
      void queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: PLAN_STALE_TIME_MS,
        gcTime: PLAN_GC_TIME_MS,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      });
    };

    prefetchIfStale(planQueryKey(planId), () => fetchPlan(planId));
    prefetchIfStale(messagesQueryKey(planId), () => fetchPlanMessages(planId));
    prefetchIfStale(expensesQueryKey(planId), () => fetchPlanExpenses(planId));
    prefetchIfStale(crewQueryKey(planId), () => fetchPlanCrew(planId));
  }, [queryClient]);

  const prefetchPlanOnHover = useCallback((planId: number) => {
    if (!Number.isFinite(planId) || planId <= 0) return;
    const existing = timersRef.current.get(planId);
    if (existing != null) return;
    const timer = window.setTimeout(() => {
      timersRef.current.delete(planId);
      prefetchPlan(planId);
    }, HOVER_PREFETCH_DELAY_MS);
    timersRef.current.set(planId, timer);
  }, [prefetchPlan]);

  const cancelHoverPrefetch = useCallback((planId: number) => {
    const timer = timersRef.current.get(planId);
    if (timer == null) return;
    window.clearTimeout(timer);
    timersRef.current.delete(planId);
  }, []);

  return {
    prefetchPlan,
    prefetchPlanOnHover,
    cancelHoverPrefetch,
  };
}
