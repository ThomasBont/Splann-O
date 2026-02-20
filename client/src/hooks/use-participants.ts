import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertParticipant } from "@shared/routes";

export function useParticipants() {
  return useQuery({
    queryKey: [api.participants.list.path],
    queryFn: async () => {
      const res = await fetch(api.participants.list.path);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return api.participants.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertParticipant) => {
      const res = await fetch(api.participants.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create participant");
      return api.participants.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.participants.list.path] });
    },
  });
}

export function useDeleteParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete participant");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.participants.list.path] });
      // Also invalidate expenses since deleting a participant might cascade delete expenses
      queryClient.invalidateQueries({ queryKey: [api.expenses.list.path] });
    },
  });
}
