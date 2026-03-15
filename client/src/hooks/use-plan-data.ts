import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExpenseWithParticipant } from "@shared/schema";
import { fetchPlan, type BarbecueListItem } from "@/hooks/use-bbq-data";
import { fetchPlanMessages, type PlanMessagesPage } from "@/hooks/use-event-chat";
import { fetchExpenses } from "@/hooks/use-expenses";
import { type EventMemberView, fetchEventMembers, fetchParticipants } from "@/hooks/use-participants";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";
import { markPlanSwitchPerf } from "@/lib/plan-switch-perf";
import { queryKeys } from "@/lib/query-keys";

const PLAN_QUERY_OPTIONS = {
  staleTime: PLAN_STALE_TIME_MS,
  gcTime: PLAN_GC_TIME_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

export function planQueryKey(planId: number | null) {
  return queryKeys.plans.detail(planId);
}

export function messagesQueryKey(planId: number | null) {
  return queryKeys.plans.messages(planId);
}

export function expensesQueryKey(planId: number | null) {
  return queryKeys.plans.expenses(planId);
}

export function crewQueryKey(planId: number | null) {
  return queryKeys.plans.crew(planId);
}

export async function fetchPlanExpenses(planId: number) {
  return (await fetchExpenses(planId)) as ExpenseWithParticipant[];
}

export type PlanCrew = {
  participants: Awaited<ReturnType<typeof fetchParticipants>>;
  members: EventMemberView[];
};

export async function fetchPlanCrew(planId: number): Promise<PlanCrew> {
  const [participants, members] = await Promise.all([
    fetchParticipants(planId),
    fetchEventMembers(planId),
  ]);
  return { participants, members };
}

export function usePlan(planId: number | null) {
  const queryClient = useQueryClient();
  return useQuery<BarbecueListItem | null>({
    queryKey: planQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return null;
      const cachedAll = queryClient.getQueryData<BarbecueListItem[]>(queryKeys.plans.list());
      if (Array.isArray(cachedAll)) {
        const match = cachedAll.find((entry) => Number(entry.id) === planId) ?? null;
        if (match) return match;
      }
      return fetchPlan(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
}

export function usePlanMessages(planId: number | null) {
  return useQuery<PlanMessagesPage>({
    queryKey: messagesQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return { messages: [], nextCursor: null, locked: false };
      return fetchPlanMessages(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
}

export function usePlanExpenses(planId: number | null) {
  const query = useQuery<ExpenseWithParticipant[]>({
    queryKey: expensesQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return [];
      return fetchPlanExpenses(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
  useEffect(() => {
    if (!import.meta.env.DEV || !planId || query.status !== "success") return;
    markPlanSwitchPerf(planId, "expenses ready", { count: query.data?.length ?? 0 });
  }, [planId, query.data, query.status]);
  return query;
}

export function usePlanCrew(planId: number | null) {
  const query = useQuery<PlanCrew>({
    queryKey: crewQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return { participants: [], members: [] };
      return fetchPlanCrew(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
  useEffect(() => {
    if (!import.meta.env.DEV || !planId || query.status !== "success") return;
    markPlanSwitchPerf(planId, "crew ready", {
      participants: query.data?.participants.length ?? 0,
      members: query.data?.members.length ?? 0,
    });
  }, [planId, query.data, query.status]);
  return query;
}
