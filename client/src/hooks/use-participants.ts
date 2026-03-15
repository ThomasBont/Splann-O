import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertParticipant } from "@shared/routes";
import type { Membership, Participant, PendingRequestWithBbq } from "@shared/schema";
import { apiFetch, apiRequest } from "@/lib/api";
import { UpgradeRequiredError } from "@/lib/upgrade";
import { PLAN_STALE_TIME_MS } from "@/lib/query-stale";
import { queryKeys } from "@/lib/query-keys";

type ApiRequestError = Error & {
  status?: number;
  code?: string;
};

export function participantsQueryKey(bbqId: number | null) {
  return queryKeys.plans.participants(bbqId);
}

export async function fetchParticipants(bbqId: number): Promise<Participant[]> {
  const url = buildUrl(api.participants.list.path, { bbqId });
  return apiRequest<Participant[]>(url);
}

export function useParticipants(bbqId: number | null) {
  return useQuery<Participant[]>({
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
  return useQuery<PendingRequestWithBbq[]>({
    queryKey: queryKeys.plans.pendingRequests(bbqId),
    queryFn: async () => {
      if (!bbqId) return [];
      const url = buildUrl(api.participants.pending.path, { bbqId });
      return apiRequest<PendingRequestWithBbq[]>(url).catch(() => []);
    },
    enabled: !!bbqId,
  });
}

export function useInvitedParticipants(bbqId: number | null) {
  return useQuery<Participant[]>({
    queryKey: queryKeys.plans.invited(bbqId),
    queryFn: async () => {
      if (!bbqId) return [];
      return apiRequest<Participant[]>(`/api/barbecues/${bbqId}/invited`).catch(() => []);
    },
    enabled: !!bbqId,
  });
}

export function useMemberships(userId: string | null) {
  return useQuery<Membership[]>({
    queryKey: queryKeys.user.memberships(userId),
    queryFn: async () => {
      if (!userId) return [];
      return apiRequest<Membership[]>(`/api/memberships?userId=${encodeURIComponent(userId)}`).catch(() => []);
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
      const res = await apiFetch(url, {
        method: "POST",
        body: data,
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402 && (body as { code?: string }).code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(body as never);
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to create participant");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
    },
  });
}

export function useJoinBarbecue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bbqId, name, userId }: { bbqId: number; name: string; userId: number }) => {
      const url = buildUrl(api.participants.join.path, { bbqId });
      const res = await apiFetch(url, {
        method: "POST",
        body: { name, userId },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402 && (body as { code?: string }).code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(body as never);
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to join");
      return body;
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.pendingRequests(bbqId) });
    },
  });
}

export function useInviteParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      if (!bbqId) throw new Error("No BBQ selected");
      const res = await apiFetch(`/api/barbecues/${bbqId}/invite`, {
        method: "POST",
        body: { username },
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402 && (body as { code?: string }).code === "UPGRADE_REQUIRED") throw new UpgradeRequiredError(body as never);
      if (!res.ok) throw new Error((body as { message?: string }).message || "Failed to invite");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invited(bbqId) });
    },
  });
}

export function useAcceptParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.accept.path, { id });
      return apiRequest(url, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.pendingRequests(bbqId) });
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
    },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; bbqId: number }) => {
      const url = buildUrl(api.participants.accept.path, { id });
      return apiRequest(url, { method: "PATCH" });
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() });
    },
  });
}

export function useDeclineInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: number; bbqId: number }) => {
      const url = buildUrl(api.participants.delete.path, { id });
      await apiRequest(url, { method: "DELETE" });
    },
    onSuccess: (_, { bbqId }) => {
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() });
    },
  });
}

export function useRejectParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      await apiRequest(url, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.pendingRequests(bbqId) });
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
    },
  });
}

export function useUpdateParticipantName(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const url = buildUrl(api.participants.update.path, { id });
      return apiRequest(url, {
        method: "PATCH",
        body: { name },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenses(bbqId) });
    },
  });
}

export function useDeleteParticipant(bbqId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.participants.delete.path, { id });
      await apiRequest(url, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.participants(bbqId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.expenses(bbqId) });
      queryClient.invalidateQueries({ queryKey: ["user", "memberships"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() });
      queryClient.refetchQueries({ queryKey: queryKeys.plans.list() });
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
  return apiRequest<EventMemberView[]>(`/api/events/${eventId}/members`);
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
      return apiRequest<EventInviteView[]>(`/api/events/${eventId}/invites?status=pending`).catch(() => []);
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
      return apiRequest(`/api/events/${eventId}/invites`, {
        method: "POST",
        body: payload,
      });
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
      const body = await apiRequest(`/api/events/${eventId}/members`, {
        method: "POST",
        body: { userId },
      });
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
      return apiRequest(`/api/events/${eventId}/invites/${inviteId}/revoke`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invitesPending(eventId) });
    },
  });
}
