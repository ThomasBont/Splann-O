import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, UserPlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEventGuests } from "@/hooks/use-event-guests";
import { type FriendRelationshipStatus, useFriendStatuses, useSendFriendRequestByUserId } from "@/hooks/use-friends";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { resolveAssetUrl } from "@/lib/asset-url";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import { cn } from "@/lib/utils";
import { PanelHeader, PanelSection, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatJoined(value?: string | null) {
  if (!value) return "Joined recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Joined recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function CrewPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { toastError, toastInfo, toastSuccess } = useAppToast();
  const { replacePanel } = usePanel();
  const addFriendByUserId = useSendFriendRequestByUserId();
  const guests = useEventGuests(eventId);
  const { members, invitesPending, loading, error } = guests;
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const [addingFriendUserId, setAddingFriendUserId] = useState<number | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, FriendRelationshipStatus>>({});
  const planQuery = usePlan(eventId);
  const normalizedPlanStatus = getClientPlanStatus(planQuery.data?.status);
  const settlementRoundsQuery = useQuery<{ activeFinalSettlementRound: { id: string } | null }>({
    queryKey: ["/api/events", eventId, "settlements", "crew-lock"],
    enabled: !!eventId,
    queryFn: async () => {
      if (!eventId) return { activeFinalSettlementRound: null };
      const res = await fetch(`/api/events/${eventId}/settlements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement lock");
      return res.json() as Promise<{ activeFinalSettlementRound: { id: string } | null }>;
    },
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
  });
  const membersLocked = normalizedPlanStatus !== "active" || !!settlementRoundsQuery.data?.activeFinalSettlementRound;
  const activeSettlementInProgress = !!settlementRoundsQuery.data?.activeFinalSettlementRound;
  const crewLockMessage = activeSettlementInProgress
    ? "Settlement is in progress. The crew is frozen until it is finished."
    : normalizedPlanStatus === "archived"
      ? "This plan is archived and fully read-only."
      : normalizedPlanStatus === "settled"
        ? "Balances are settled. Crew changes are locked during wrap-up."
        : normalizedPlanStatus === "closed"
          ? "This plan is closed. Crew changes are locked."
          : null;

  const orderedMembers = useMemo(() => {
    if (members.length === 0) return members;
    const rankedRows = buildCrewContributionRows({ participants, members, expenses });
    if (rankedRows.length === 0) return members;

    const rankedMembers = rankedRows
      .map((row) => members.find((member) => member.userId === row.userId || member.name.trim().toLowerCase() === row.name.trim().toLowerCase()) ?? null)
      .filter((member): member is (typeof members)[number] => !!member);

    const remainingMembers = members.filter((member) => !rankedMembers.some((ranked) => ranked.id === member.id));
    const combined = [...rankedMembers, ...remainingMembers];
    const currentUserIndex = combined.findIndex((member) => Number(member.userId) === Number(user?.id));
    if (currentUserIndex <= 0) return combined;
    const [currentUserMember] = combined.splice(currentUserIndex, 1);
    return [currentUserMember, ...combined];
  }, [expenses, members, participants, user?.id]);

  const openMemberProfile = (username?: string | null) => {
    const targetUsername = username?.trim();
    if (!targetUsername) return;
    replacePanel({ type: "member-profile", username: targetUsername, source: "crew" });
  };

  const friendStatusUserIds = useMemo(
    () => orderedMembers
      .map((member) => Number(member.userId))
      .filter((memberUserId) => Number.isInteger(memberUserId) && memberUserId > 0 && memberUserId !== Number(user?.id)),
    [orderedMembers, user?.id],
  );
  const friendStatusesQuery = useFriendStatuses(friendStatusUserIds);

  const getFriendStatus = (memberUserId?: number | null): FriendRelationshipStatus | null => {
    if (!memberUserId || memberUserId === user?.id) return null;
    const key = String(memberUserId);
    return statusOverrides[key] ?? friendStatusesQuery.data?.[key] ?? "not_friends";
  };

  const handleAddFriend = async (memberUserId: number) => {
    const key = String(memberUserId);
    const previous = statusOverrides[key] ?? friendStatusesQuery.data?.[key] ?? "not_friends";
    setAddingFriendUserId(memberUserId);
    setStatusOverrides((prev) => ({ ...prev, [key]: "pending_outgoing" }));
    try {
      const response = await addFriendByUserId.mutateAsync(memberUserId);
      const nextStatus = response.status ?? "pending_outgoing";
      setStatusOverrides((prev) => ({ ...prev, [key]: nextStatus }));
      if (nextStatus === "friends") toastInfo("Already friends");
      else toastSuccess("Friend request sent");
      void friendStatusesQuery.refetch();
    } catch (error) {
      setStatusOverrides((prev) => ({ ...prev, [key]: previous }));
      toastError((error as Error).message || "Couldn’t send friend request.");
    } finally {
      setAddingFriendUserId(null);
    }
  };

  return (
    <PanelShell>
      <PanelHeader
        title="Crew"
        meta={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{members.length} members · {invitesPending.length} pending</span>}
        actions={(
          <Button
            type="button"
            size="sm"
            className={panelHeaderAddButtonClass()}
            onClick={() => replacePanel({ type: "invite", source: "crew" })}
            disabled={membersLocked}
          >
            Invite Friends +
          </Button>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {membersLocked ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
            {crewLockMessage}
          </div>
        ) : null}
        {loading ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            Loading crew...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Could not load the crew for this plan.
          </div>
        ) : (
          <>
            <PanelSection title="Members" variant="list">
              <div className="divide-y divide-[hsl(var(--border-subtle))]">
                {orderedMembers.length > 0 ? orderedMembers.map((member) => (
                  member.username ? (
                    <div key={`crew-member-${member.id}`} className="flex items-start gap-3 px-1 py-3 first:pt-0 last:pb-0">
                      <button
                        type="button"
                        onClick={() => openMemberProfile(member.username)}
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left transition hover:bg-[hsl(var(--surface-2))]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Avatar className="h-10 w-10">
                          {member.avatarUrl ? <AvatarImage src={resolveAssetUrl(member.avatarUrl) ?? member.avatarUrl} alt={member.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {initials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">@{member.username}</p>
                          <p className="mt-1 text-xs text-muted-foreground/70">{member.role === "owner" ? "Owner" : "Member"}</p>
                        </div>
                        <div className="shrink-0 pt-0.5 text-right">
                          <span className="block text-[11px] text-muted-foreground/75">
                            {formatJoined(member.joinedAt)}
                          </span>
                          <span className="mt-1 block text-[11px] text-muted-foreground/60">
                            View profile
                          </span>
                        </div>
                      </button>
                      {member.userId && Number(member.userId) !== Number(user?.id) ? (
                        getFriendStatus(Number(member.userId)) === "not_friends" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="mt-0.5 h-8 shrink-0 rounded-full px-3"
                            onClick={() => void handleAddFriend(Number(member.userId))}
                            disabled={addingFriendUserId === Number(member.userId) || addFriendByUserId.isPending}
                          >
                            {addingFriendUserId === Number(member.userId) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus2 className="h-3.5 w-3.5" />}
                            Add
                          </Button>
                        ) : getFriendStatus(Number(member.userId)) === "friends" ? (
                          <span className="mt-0.5 inline-flex h-8 shrink-0 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs text-emerald-700 dark:text-emerald-300">
                            Friend
                          </span>
                        ) : (
                          <span className="mt-0.5 inline-flex h-8 shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 text-xs text-amber-700 dark:text-amber-300">
                            Pending
                          </span>
                        )
                      ) : null}
                    </div>
                  ) : (
                    <div key={`crew-member-${member.id}`} className="flex items-start gap-3 px-1 py-3 first:pt-0 last:pb-0">
                      <Avatar className="h-10 w-10">
                        {member.avatarUrl ? <AvatarImage src={resolveAssetUrl(member.avatarUrl) ?? member.avatarUrl} alt={member.name} /> : null}
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {initials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                        <p className={cn("mt-1 text-xs", member.role === "owner" ? "text-muted-foreground/70" : "text-muted-foreground/70")}>
                          {member.role === "owner" ? "Owner" : "Member"}
                        </p>
                      </div>
                      <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground/75">
                        {formatJoined(member.joinedAt)}
                      </span>
                    </div>
                  )
                )) : (
                  <p className="text-sm text-muted-foreground">No crew members yet.</p>
                )}
              </div>
            </PanelSection>

            {invitesPending.length > 0 ? (
              <PanelSection title="Pending invites" variant="list">
                <div className="divide-y divide-[hsl(var(--border-subtle))]">
                  {invitesPending.map((invite) => (
                    <div key={`crew-invite-${invite.id}`} className="px-1 py-3 first:pt-0 last:pb-0">
                      <p className="text-sm font-medium text-foreground">
                        {invite.invitee?.name ?? invite.email ?? "Pending invite"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invite.invitee?.username ? `@${invite.invitee.username}` : "Waiting for response"}
                      </p>
                    </div>
                  ))}
                </div>
              </PanelSection>
            ) : null}
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default CrewPanel;
