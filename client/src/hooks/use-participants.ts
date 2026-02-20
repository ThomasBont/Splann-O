import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertParticipant } from "@shared/routes";
import type { Membership } from "@shared/schema";

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

export function usePendingRequests(bbqId: number | null) {
  return useQuery({
    queryKey: ['/api/barbecues', bbqId, 'pending'],
    queryFn: async () => {
      if (!bbqId) return [];
      const url = buildUrl(api.participants.pending.path, { bbqId });
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!bbqId,
  });
}

export function useMemberships(userId: string | null) {
  return useQuery<Membership[]>({
    queryKey: ['/api/memberships', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/memberships?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!userId,
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

export function useJoinBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bbqId, name, userId }: { bbqId: number; name: string; userId: string }) => {
      const url = buildUrl(api.participants.join.path, { bbqId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to join");
      return data;
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'pending'] });
    },
  });
}

export function useAcceptParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.accept.path, { id });
      const res = await fetch(url, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to accept");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
    },
  });
}

export function useRejectParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to reject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
    },
  });
}
