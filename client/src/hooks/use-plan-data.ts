import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Barbecue, ExpenseWithParticipant } from "@shared/schema";
import { fetchPlan } from "@/hooks/use-bbq-data";
import { fetchPlanMessages, type PlanMessagesPage } from "@/hooks/use-event-chat";
import { fetchExpenses } from "@/hooks/use-expenses";
import { type EventMemberView, fetchEventMembers, fetchParticipants } from "@/hooks/use-participants";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

const PLAN_QUERY_OPTIONS = {
  staleTime: PLAN_STALE_TIME_MS,
  gcTime: PLAN_GC_TIME_MS,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
} as const;

export function planQueryKey(planId: number | null) {
  return ["plan", planId] as const;
}

export function messagesQueryKey(planId: number | null) {
  return ["messages", planId] as const;
}

export function expensesQueryKey(planId: number | null) {
  return ["expenses", planId] as const;
}

export function crewQueryKey(planId: number | null) {
  return ["crew", planId] as const;
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
  return useQuery<Barbecue | null>({
    queryKey: planQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return null;
      const cachedAll = queryClient.getQueryData<Barbecue[]>(["/api/barbecues"]);
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
  return useQuery<ExpenseWithParticipant[]>({
    queryKey: expensesQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return [];
      return fetchPlanExpenses(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
}

export function usePlanCrew(planId: number | null) {
  return useQuery<PlanCrew>({
    queryKey: crewQueryKey(planId),
    enabled: !!planId,
    queryFn: async () => {
      if (!planId) return { participants: [], members: [] };
      return fetchPlanCrew(planId);
    },
    ...PLAN_QUERY_OPTIONS,
  });
}
