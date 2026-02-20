import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertParticipant, type InsertExpense, type UpdateExpenseRequest } from "@shared/routes";

// ============================================
// PARTICIPANTS
// ============================================

export function useParticipants() {
  return useQuery({
    queryKey: [api.participants.list.path],
    queryFn: async () => {
      const res = await fetch(api.participants.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch participants');
      return api.participants.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertParticipant) => {
      const validated = api.participants.create.input.parse(data);
      const res = await fetch(api.participants.create.path, {
        method: api.participants.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create participant');
      return api.participants.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.participants.list.path] }),
  });
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      const res = await fetch(url, { method: api.participants.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete participant');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.participants.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] }); // Deleting user might affect expenses
    },
  });
}

// ============================================
// EXPENSES
// ============================================

export function useExpenses() {
  return useQuery({
    queryKey: [api.expenses.list.path],
    queryFn: async () => {
      const res = await fetch(api.expenses.list.path, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch expenses');
      return api.expenses.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertExpense) => {
      const validated = api.expenses.create.input.parse(data);
      const res = await fetch(api.expenses.create.path, {
        method: api.expenses.create.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to create expense');
      return api.expenses.create.responses[201].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] }),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateExpenseRequest) => {
      const validated = api.expenses.update.input.parse(updates);
      const url = buildUrl(api.expenses.update.path, { id });
      const res = await fetch(url, {
        method: api.expenses.update.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to update expense');
      return api.expenses.update.responses[200].parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] }),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.expenses.delete.path, { id });
      const res = await fetch(url, { method: api.expenses.delete.method, credentials: "include" });
      if (!res.ok) throw new Error('Failed to delete expense');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] }),
  });
}
