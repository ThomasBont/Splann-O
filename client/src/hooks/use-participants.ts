import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertParticipant } from "@shared/routes";

export function useParticipants(bbqId: number | null) {
  return useQuery({
    queryKey: ['/api/barbecues', bbqId, 'participants'],
    queryFn: async () => {
      if (!bbqId) return [];
      const url = buildUrl(api.participants.list.path, { bbqId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
    enabled: !!bbqId,
  });
}

export function useCreateParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertParticipant) => {
      if (!bbqId) throw new Error("No BBQ selected");
      const url = buildUrl(api.participants.create.path, { bbqId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create participant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
    },
  });
}

export function useDeleteParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete participant");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'] });
    },
  });
}
