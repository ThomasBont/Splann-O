import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { FriendInfo } from "@shared/schema";

export function useFriends() {
  return useQuery<FriendInfo[]>({
    queryKey: ['/api/friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends');
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useFriendRequests() {
  return useQuery<FriendInfo[]>({
    queryKey: ['/api/friends/requests'],
    queryFn: async () => {
      const res = await fetch('/api/friends/requests');
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15000,
  });
}

export function useSentFriendRequests() {
  return useQuery<FriendInfo[]>({
    queryKey: ['/api/friends/sent'],
    queryFn: async () => {
      const res = await fetch('/api/friends/sent');
      if (!res.ok) return [];
      return res.json();
    },
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/sent'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/requests'] });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`/api/friends/${friendshipId}/accept`, { method: 'PATCH' });
      if (!res.ok) throw new Error("Failed to accept");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/sent'] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to remove");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends/sent'] });
    },
  });
}

export function useSearchUsers(query: string) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: ['/api/users/search', normalizedQuery],
    queryFn: async ({ signal }) => {
      if (!normalizedQuery || normalizedQuery.length < 2) return [];
      if (import.meta.env.DEV) {
        console.debug(`[friends-search] q=${normalizedQuery}`);
      }
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(normalizedQuery)}`, { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message || "Failed to search users");
      }
      const body = await res.json() as {
        users?: Array<{ id: number; displayName?: string | null; handle?: string | null; username?: string | null; avatarUrl?: string | null }>;
      };
      const rows = Array.isArray(body.users) ? body.users : [];
      return rows.map((row) => ({
        id: row.id,
        displayName: row.displayName ?? row.handle ?? row.username ?? "",
        username: row.username ?? row.handle ?? "",
        avatarUrl: row.avatarUrl ?? null,
      }));
    },
    enabled: normalizedQuery.length >= 2,
    staleTime: 15_000,
  });
}

export function useAllPendingRequests() {
  return useQuery({
    queryKey: ['/api/pending-requests/all'],
    queryFn: async () => {
      const res = await fetch('/api/pending-requests/all');
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });
}
