import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";

export function useBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch barbecues");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function usePublicBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues/public'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.listPublic.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch public events");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function useCreateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      date: string;
      currency: string;
      creatorId?: string;
      isPublic?: boolean;
      allowOptInExpenses?: boolean;
      area?: string;
      eventType?: string;
      templateData?: unknown;
    }) => {
      const res = await fetch(api.barbecues.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to create barbecue");
      }
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useUpdateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, allowOptInExpenses }: { id: number; allowOptInExpenses?: boolean }) => {
      const url = buildUrl(api.barbecues.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ allowOptInExpenses }),
      });
      if (!res.ok) throw new Error("Failed to update barbecue");
      return res.json() as Promise<Barbecue>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useDeleteBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.barbecues.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete barbecue");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}
