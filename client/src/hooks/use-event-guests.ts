import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventRealtime } from "@/lib/event-realtime";
import { queryKeys } from "@/lib/query-keys";
import {
  type EventInviteView,
  type EventMemberView,
  useCreateEventInvite,
  useEventMembers,
  usePendingEventInvites,
  useRevokeEventInvite,
} from "@/hooks/use-participants";

type MemberJoinedPayload = {
  type?: string;
  eventId?: number;
  member?: EventMemberView;
};

type InviteCreatedPayload = {
  type?: string;
  eventId?: number;
  invite?: EventInviteView & { inviteeUserId?: number | null };
};

type InviteRevokedPayload = {
  type?: string;
  eventId?: number;
  inviteId?: string;
};

export function useEventGuests(eventId: number | null) {
  const queryClient = useQueryClient();
  const lastConnectedVersionRef = useRef(0);
  const membersQuery = useEventMembers(eventId);
  const pendingInvitesQuery = usePendingEventInvites(eventId);
  const createInviteMutation = useCreateEventInvite(eventId);
  const revokeInviteMutation = useRevokeEventInvite(eventId);
  const realtime = useEventRealtime(eventId, !!eventId, (rawPayload) => {
    const payload = rawPayload as MemberJoinedPayload | InviteCreatedPayload | InviteRevokedPayload;
    if (!payload || payload.eventId !== eventId || typeof payload.type !== "string") return;
    if (payload.type === "event:member_joined") {
      const member = (payload as MemberJoinedPayload).member;
      if (!member) return;
      queryClient.setQueryData<EventMemberView[]>(queryKeys.plans.members(eventId!), (prev = []) => {
        if (prev.some((m) => m.userId === member.userId)) return prev;
        return [member, ...prev];
      });
      queryClient.setQueryData<EventInviteView[]>(queryKeys.plans.invitesPending(eventId!), (prev = []) =>
        prev.filter((invite) => {
          const inviteeUserId = Number(invite.inviteeUserId ?? invite.invitee?.userId ?? 0);
          return !Number.isFinite(inviteeUserId) || inviteeUserId <= 0 || inviteeUserId !== Number(member.userId);
        }),
      );
      return;
    }
    if (payload.type === "event:invite_created") {
      const invite = (payload as InviteCreatedPayload).invite;
      if (!invite) return;
      queryClient.setQueryData<EventInviteView[]>(queryKeys.plans.invitesPending(eventId!), (prev = []) => {
        if (prev.some((inv) => inv.id === invite.id)) return prev;
        return [invite, ...prev];
      });
      return;
    }
    if (payload.type === "event:invite_revoked") {
      const inviteId = (payload as InviteRevokedPayload).inviteId;
      if (!inviteId) return;
      queryClient.setQueryData<EventInviteView[]>(queryKeys.plans.invitesPending(eventId!), (prev = []) =>
        prev.filter((inv) => inv.id !== inviteId),
      );
    }
  });

  useEffect(() => {
    if (!eventId) {
      lastConnectedVersionRef.current = 0;
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || realtime.connectedVersion <= 0) return;
    if (lastConnectedVersionRef.current === 0) {
      lastConnectedVersionRef.current = realtime.connectedVersion;
      return;
    }
    if (lastConnectedVersionRef.current === realtime.connectedVersion) return;
    lastConnectedVersionRef.current = realtime.connectedVersion;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.members(eventId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invitesPending(eventId) }),
    ]);
  }, [eventId, queryClient, realtime.connectedVersion]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.members(eventId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.invitesPending(eventId) }),
    ]);
  }, [eventId, queryClient]);

  const createInvite = useCallback(async ({ userId }: { userId: number }) => {
    return createInviteMutation.mutateAsync({ userId });
  }, [createInviteMutation]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    return revokeInviteMutation.mutateAsync({ inviteId });
  }, [revokeInviteMutation]);

  const addMember = useCallback(async (userId: number) => {
    return createInvite({ userId });
  }, [createInvite]);

  const loading = membersQuery.isLoading || pendingInvitesQuery.isLoading;
  const error = membersQuery.isError ? membersQuery.error : pendingInvitesQuery.isError ? pendingInvitesQuery.error : null;
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const invitesPending = useMemo(() => pendingInvitesQuery.data ?? [], [pendingInvitesQuery.data]);

  return {
    members,
    invitesPending,
    loading,
    error,
    refresh,
    createInvite,
    revokeInvite,
    addMember,
    inviteMutating: createInviteMutation.isPending,
    revokeMutating: revokeInviteMutation.isPending,
    addMemberMutating: createInviteMutation.isPending,
  };
}

export type UseEventGuestsResult = ReturnType<typeof useEventGuests>;
