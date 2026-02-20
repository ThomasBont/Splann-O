import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Barbecue } from "@shared/schema";

export function useBarbecues() {
  return useQuery({
    queryKey: ['/api/barbecues'],
    queryFn: async () => {
      const res = await fetch(api.barbecues.list.path);
      if (!res.ok) throw new Error("Failed to fetch barbecues");
      return res.json() as Promise<Barbecue[]>;
    },
  });
}

export function useCreateBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; date: string; currency: string }) => {
      const res = await fetch(api.barbecues.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create barbecue");
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
