import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertExpense, UpdateExpenseRequest } from "@shared/routes";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

export type RealtimePlanBalances = {
  type: "plan:balancesUpdated";
  planId: number;
  balances: Array<{ id: number; name: string; paid: number; balance: number }>;
  suggestedPaybacks: Array<{ from: string; to: string; amount: number }>;
  updatedAt: string;
  version: number;
};

export function planBalancesQueryKey(planId: number | null) {
  return ["/api/plans", planId, "balances-realtime"] as const;
}

export function expensesQueryKey(bbqId: number | null) {
  return ['/api/barbecues', bbqId, 'expenses'] as const;
}

export function planExpensesQueryKey(bbqId: number | null) {
  return ["expenses", bbqId] as const;
}

function updateExpenseCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  bbqId: number | null,
  updater: (old: unknown) => unknown,
) {
  queryClient.setQueryData(expensesQueryKey(bbqId), updater);
  queryClient.setQueryData(planExpensesQueryKey(bbqId), updater);
}

export async function fetchExpenses(bbqId: number) {
  const url = buildUrl(api.expenses.list.path, { bbqId });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export function useRealtimePlanBalances(planId: number | null) {
  return useQuery<RealtimePlanBalances | null>({
    queryKey: planBalancesQueryKey(planId),
    enabled: false,
    initialData: null,
    queryFn: async () => null,
  });
}

export function useExpenses(bbqId: number | null) {
  return useQuery({
    queryKey: expensesQueryKey(bbqId),
    queryFn: async () => {
      if (!bbqId) return [];
      return fetchExpenses(bbqId);
    },
    enabled: !!bbqId,
    staleTime: PLAN_STALE_TIME_MS,
    gcTime: PLAN_GC_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useCreateExpense(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertExpense) => {
      if (!bbqId) throw new Error("No BBQ selected");
      const url = buildUrl(api.expenses.create.path, { bbqId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string }));
        throw new Error(body.message || "Failed to create expense");
      }
      return res.json();
    },
    onSuccess: (createdExpense) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return [createdExpense];
        return [...old, createdExpense];
      });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expense-shares'] });
    },
  });
}

export function useUpdateExpense(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateExpenseRequest) => {
      const url = buildUrl(api.expenses.update.path, { id });
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Failed to update expense");
      return res.json();
    },
    onSuccess: (updatedExpense) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((expense) => {
          if (Number((expense as { id?: unknown }).id) !== Number((updatedExpense as { id?: unknown }).id)) return expense;
          return { ...expense, ...updatedExpense };
        });
      });
    },
  });
}

export function useDeleteExpense(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.expenses.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
    },
    onSuccess: (_result, deletedId) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((expense) => Number((expense as { id?: unknown }).id) !== deletedId);
      });
    },
  });
}

export function useExpenseShares(bbqId: number | null) {
  return useQuery({
    queryKey: ['/api/barbecues', bbqId, 'expense-shares'],
    queryFn: async () => {
      if (!bbqId) return [];
      const url = buildUrl('/api/barbecues/:bbqId/expense-shares', { bbqId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch expense shares");
      return res.json() as Promise<{ expenseId: number; participantId: number }[]>;
    },
    enabled: !!bbqId,
  });
}

export function useSetExpenseShare(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, in: inShare }: { expenseId: number; in: boolean }) => {
      if (!bbqId) throw new Error("No BBQ selected");
      const url = `/api/barbecues/${bbqId}/expenses/${expenseId}/share`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ in: inShare }),
      });
      if (!res.ok) throw new Error("Failed to update expense share");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expense-shares'] });
    },
  });
}

export function useUploadExpenseReceipt(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, dataUrl }: { expenseId: number; dataUrl: string }) => {
      const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });
      if (!res.ok) throw new Error("Failed to upload receipt");
      return res.json() as Promise<{
        expenseId: number;
        receiptUrl: string | null;
        receiptMime: string | null;
        receiptUploadedAt: string | null;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'] });
    },
  });
}

export function useDeleteExpenseReceipt(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: number) => {
      const res = await fetch(`/api/expenses/${expenseId}/receipt`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove receipt");
      return res.json() as Promise<{ expenseId: number; receiptUrl: null }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'] });
    },
  });
}
