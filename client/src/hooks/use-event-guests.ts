import { useCallback, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type EventInviteView,
  type EventMemberView,
  useCreateEventInvite,
  useEventMembers,
  usePendingEventInvites,
  useRevokeEventInvite,
} from "@/hooks/use-participants";

function eventWsUrl(eventId: number) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/events/${eventId}/chat`;
}

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
  const membersQuery = useEventMembers(eventId);
  const pendingInvitesQuery = usePendingEventInvites(eventId);
  const createInviteMutation = useCreateEventInvite(eventId);
  const revokeInviteMutation = useRevokeEventInvite(eventId);

  useEffect(() => {
    if (!eventId) return;
    const ws = new WebSocket(eventWsUrl(eventId));
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "event:subscribe", eventId }));
    };
    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(String(ev.data)) as MemberJoinedPayload | InviteCreatedPayload | InviteRevokedPayload;
        if (!payload || payload.eventId !== eventId || typeof payload.type !== "string") return;
        if (payload.type === "event:member_joined") {
          const member = (payload as MemberJoinedPayload).member;
          if (!member) return;
          queryClient.setQueryData<EventMemberView[]>(["/api/events", eventId, "members"], (prev = []) => {
            if (prev.some((m) => m.userId === member.userId)) return prev;
            return [member, ...prev];
          });
          return;
        }
        if (payload.type === "event:invite_created") {
          const invite = (payload as InviteCreatedPayload).invite;
          if (!invite) return;
          queryClient.setQueryData<EventInviteView[]>(["/api/events", eventId, "invites", "pending"], (prev = []) => {
            if (prev.some((inv) => inv.id === invite.id)) return prev;
            return [invite, ...prev];
          });
          return;
        }
        if (payload.type === "event:invite_revoked") {
          const inviteId = (payload as InviteRevokedPayload).inviteId;
          if (!inviteId) return;
          queryClient.setQueryData<EventInviteView[]>(["/api/events", eventId, "invites", "pending"], (prev = []) =>
            prev.filter((inv) => inv.id !== inviteId),
          );
        }
      } catch {
        // Ignore websocket payload parse errors.
      }
    };
    return () => {
      ws.close();
    };
  }, [eventId, queryClient]);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "members"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId, "invites", "pending"] }),
    ]);
  }, [eventId, queryClient]);

  const createInvite = useCallback(async ({ email, userId }: { email?: string; userId?: number }) => {
    const payload = {
      email: email?.trim() ? email.trim() : undefined,
      userId,
    };
    return createInviteMutation.mutateAsync(payload);
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
