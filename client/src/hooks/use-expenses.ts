import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertExpense, UpdateExpenseRequest } from "@shared/routes";
import { apiRequest } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { PLAN_GC_TIME_MS, PLAN_STALE_TIME_MS } from "@/lib/query-stale";

export type RealtimePlanBalances = {
  type: "plan:balancesUpdated";
  planId: number;
  balances: Array<{ id: number; name: string; paid: number; balance: number }>;
  suggestedPaybacks: Array<{ from: string; to: string; amount: number }>;
  updatedAt: string;
  version: number;
};

type ExpenseRecord = any;

export function planBalancesQueryKey(planId: number | null) {
  return queryKeys.plans.balances(planId);
}

export function expensesQueryKey(bbqId: number | null) {
  return queryKeys.plans.expenses(bbqId);
}

export function planExpensesQueryKey(bbqId: number | null) {
  return queryKeys.plans.expenses(bbqId);
}

function updateExpenseCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  bbqId: number | null,
  updater: (old: unknown) => unknown,
) {
  queryClient.setQueryData(expensesQueryKey(bbqId), updater);
}

async function invalidateExpenseRelatedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  bbqId: number | null,
) {
  if (!bbqId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenses(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenseShares(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.activity(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.messages(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.balances(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.settlements(bbqId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.plans.settlementLatest(bbqId) }),
    queryClient.invalidateQueries({ queryKey: ["plans", "detail", bbqId, "settlements", "detail"] }),
  ]);
}

export async function fetchExpenses(bbqId: number): Promise<ExpenseRecord[]> {
  const url = buildUrl(api.expenses.list.path, { bbqId });
  return apiRequest<ExpenseRecord[]>(url);
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
  return useQuery<ExpenseRecord[]>({
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
      return apiRequest<ExpenseRecord>(url, {
        method: "POST",
        body: data,
      });
    },
    onSuccess: async (createdExpense) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return [createdExpense];
        return [...old, createdExpense];
      });
      await invalidateExpenseRelatedQueries(queryClient, bbqId);
    },
  });
}

export function useUpdateExpense(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateExpenseRequest) => {
      const url = buildUrl(api.expenses.update.path, { id });
      return apiRequest<ExpenseRecord>(url, {
        method: "PUT",
        body: updates,
      });
    },
    onSuccess: async (updatedExpense) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((expense) => {
          if (Number((expense as { id?: unknown }).id) !== Number((updatedExpense as { id?: unknown }).id)) return expense;
          return { ...expense, ...updatedExpense };
        });
      });
      await invalidateExpenseRelatedQueries(queryClient, bbqId);
    },
  });
}

export function useDeleteExpense(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.expenses.delete.path, { id });
      await apiRequest(url, { method: "DELETE" });
    },
    onSuccess: async (_result, deletedId) => {
      updateExpenseCaches(queryClient, bbqId, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter((expense) => Number((expense as { id?: unknown }).id) !== deletedId);
      });
      await invalidateExpenseRelatedQueries(queryClient, bbqId);
    },
  });
}

export function useExpenseShares(bbqId: number | null) {
  return useQuery({
    queryKey: queryKeys.plans.expenseShares(bbqId),
    queryFn: async () => {
      if (!bbqId) return [];
      const url = buildUrl('/api/barbecues/:bbqId/expense-shares', { bbqId });
      return apiRequest<{ expenseId: number; participantId: number }[]>(url);
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
      await apiRequest(url, {
        method: "PATCH",
        body: { in: inShare },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenseShares(bbqId) });
    },
  });
}

export function useUploadExpenseReceipt(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ expenseId, dataUrl }: { expenseId: number; dataUrl: string }) => {
      return apiRequest<{
        expenseId: number;
        receiptUrl: string | null;
        receiptMime: string | null;
        receiptUploadedAt: string | null;
      }>(`/api/expenses/${expenseId}/receipt`, {
        method: "POST",
        body: { dataUrl },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesQueryKey(bbqId) });
    },
  });
}

export function useDeleteExpenseReceipt(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: number) => {
      return apiRequest<{ expenseId: number; receiptUrl: null }>(`/api/expenses/${expenseId}/receipt`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: expensesQueryKey(bbqId) });
    },
  });
}
