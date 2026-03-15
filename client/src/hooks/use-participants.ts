import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertParticipant } from "@shared/routes";
import type { Membership } from "@shared/schema";
import { UpgradeRequiredError } from "@/lib/upgrade";
import { PLAN_STALE_TIME_MS } from "@/lib/query-stale";
import { queryKeys } from "@/lib/query-keys";

type ApiRequestError = Error & {
  status?: number;
  code?: string;
};

export function participantsQueryKey(bbqId: number | null) {
  return ['/api/barbecues', bbqId, 'participants'] as const;
}

export async function fetchParticipants(bbqId: number) {
  const url = buildUrl(api.participants.list.path, { bbqId });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch participants");
  return res.json();
}

export function useParticipants(bbqId: number | null) {
  return useQuery({
    queryKey: participantsQueryKey(bbqId),
    queryFn: async () => {
      if (!bbqId) return [];
      return fetchParticipants(bbqId);
    },
    enabled: !!bbqId,
    staleTime: PLAN_STALE_TIME_MS,
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

export function useInvitedParticipants(bbqId: number | null) {
  return useQuery({
    queryKey: ['/api/barbecues', bbqId, 'invited'],
    queryFn: async () => {
      if (!bbqId) return [];
      const res = await fetch(`/api/barbecues/${bbqId}/invited`);
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
      const resBody = await res.json().catch(() => ({}));
      if (res.status === 402 && resBody?.code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(resBody);
      if (!res.ok) throw new Error(resBody?.message || "Failed to create participant");
      return resBody;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
    },
  });
}

export function useJoinBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bbqId, name, userId }: { bbqId: number; name: string; userId: number }) => {
      const url = buildUrl(api.participants.join.path, { bbqId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, userId }),
      });
      const data = await res.json();
      if (res.status === 402 && data?.code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(data);
      if (!res.ok) throw new Error(data.message || "Failed to join");
      return data;
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'pending'] });
    },
  });
}

export function useInviteParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!bbqId) throw new Error("No BBQ selected");
      const res = await fetch(`/api/barbecues/${bbqId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.status === 402 && data?.code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(data);
      if (!res.ok) throw new Error(data.message || "Failed to invite");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'invited'] });
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

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; bbqId: number }) => {
      const url = buildUrl(api.participants.accept.path, { id });
      const res = await fetch(url, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to accept invite");
      return res.json();
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; bbqId: number }) => {
      const url = buildUrl(api.participants.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to decline");
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/memberships'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
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

export function useUpdateParticipantName(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const url = buildUrl(api.participants.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update name");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'participants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/barbecues'] });
      queryClient.refetchQueries({ queryKey: ['/api/barbecues'] });
    },
  });
}

export type EventMemberView = {
  id: string;
  userId: number;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  role: "member" | "owner" | string;
  joinedAt?: string | null;
};

export type EventInviteView = {
  id: string;
  email?: string | null;
  inviteeUserId?: number | null;
  inviteType?: "user" | string;
  invitee?: {
    userId: number;
    name: string;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  status: "pending" | "accepted" | "declined" | "revoked" | "expired" | string;
  createdAt?: string | null;
  expiresAt?: string | null;
};

export function eventMembersQueryKey(eventId: number | null) {
  return queryKeys.plans.members(eventId);
}

export async function fetchEventMembers(eventId: number) {
  const res = await fetch(`/api/events/${eventId}/members`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch members");
  return (await res.json()) as EventMemberView[];
}

export function useEventMembers(eventId: number | null) {
  return useQuery<EventMemberView[]>({
    queryKey: eventMembersQueryKey(eventId),
    queryFn: async () => {
      if (!eventId) return [];
      return fetchEventMembers(eventId);
    },
    enabled: !!eventId,
    staleTime: PLAN_STALE_TIME_MS,
  });
}

export function usePendingEventInvites(eventId: number | null) {
  return useQuery<EventInviteView[]>({
    queryKey: queryKeys.plans.invitesPending(eventId),
    queryFn: async () => {
      if (!eventId) return [];
      const res = await fetch(`/api/events/${eventId}/invites?status=pending`, { credentials: "include" });
      if (!res.ok) return [];
      return (await res.json()) as EventInviteView[];
    },
    enabled: !!eventId,
    staleTime: PLAN_STALE_TIME_MS,
    refetchInterval: eventId ? 15_000 : false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateEventInvite(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId: number }) => {
      if (!eventId) throw new Error("No event selected");
      const res = await fetch(`/api/events/${eventId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to create invite");
      return body as {
        inviteId: string;
        inviteeUserId?: number | null;
        status?: string;
        createdAt?: string | null;
        expiresAt?: string | null;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invitesPending(eventId) });
    },
  });
}

export function useAddEventMember(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      if (!eventId) throw new Error("No event selected");
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error((body as { message?: string }).message || "Failed to add member") as ApiRequestError;
        err.status = res.status;
        err.code = (body as { code?: string }).code;
        throw err;
      }
      return body as EventMemberView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.members(eventId) });
    },
  });
}

export function useRevokeEventInvite(eventId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId }: { inviteId: string }) => {
      if (!eventId) throw new Error("No event selected");
      const res = await fetch(`/api/events/${eventId}/invites/${inviteId}/revoke`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to revoke invite");
      return body as { id: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invitesPending(eventId) });
    },
  });
}
