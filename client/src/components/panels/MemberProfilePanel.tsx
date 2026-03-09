import { useMemo, useState } from "react";
import { Loader2, UserMinus, UserPlus2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { type FriendRelationshipStatus, useFriendStatuses, useFriends, useRemoveFriend, useSendFriendRequestByUserId } from "@/hooks/use-friends";
import { useUserProfile } from "@/hooks/use-user-profile";
import { usePlanCrew } from "@/hooks/use-plan-data";
import { resolveAssetUrl } from "@/lib/asset-url";

function initials(value: string) {
  const safe = value.trim();
  if (!safe) return "U";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return safe.slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function formatJoined(value?: string | null) {
  if (!value) return "Joined recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Joined recently";
  return `Joined ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function MemberProfilePanel({ username }: { username: string }) {
  const { user } = useAuth();
  const { toastError, toastInfo, toastSuccess } = useAppToast();
  const eventId = useActiveEventId();
  const crewQuery = usePlanCrew(eventId);
  const profileQuery = useUserProfile(username);
  const friendsQuery = useFriends();
  const sendFriendRequest = useSendFriendRequestByUserId();
  const removeFriend = useRemoveFriend();
  const [statusOverride, setStatusOverride] = useState<FriendRelationshipStatus | null>(null);
  const member = (crewQuery.data?.members ?? []).find((entry) => entry.username === username) ?? null;
  const profile = profileQuery.data?.user ?? null;
  const profileName = profile?.displayName || member?.name || username;
  const avatarUrl = profile?.profileImageUrl || profile?.avatarUrl || member?.avatarUrl || null;
  const targetUserId = profile?.id ?? member?.userId ?? null;
  const friendStatusesQuery = useFriendStatuses(
    targetUserId && targetUserId !== user?.id ? [targetUserId] : [],
  );
  const friendStatus = targetUserId && targetUserId !== user?.id
    ? statusOverride ?? friendStatusesQuery.data?.[String(targetUserId)] ?? "not_friends"
    : null;
  const existingFriendshipId = useMemo(
    () => targetUserId ? (friendsQuery.data ?? []).find((friend) => friend.userId === Number(targetUserId))?.friendshipId ?? null : null,
    [friendsQuery.data, targetUserId],
  );

  const handleAddFriend = async () => {
    if (!targetUserId || targetUserId === user?.id) return;
    const previousStatus = friendStatus ?? "not_friends";
    setStatusOverride("pending_outgoing");
    try {
      const response = await sendFriendRequest.mutateAsync(targetUserId);
      const nextStatus = response.status ?? "pending_outgoing";
      setStatusOverride(nextStatus);
      if (nextStatus === "friends") toastInfo("Already friends");
      else toastSuccess("Friend request sent");
      void friendStatusesQuery.refetch();
    } catch (error) {
      setStatusOverride(previousStatus);
      toastError((error as Error).message || "Couldn’t send friend request.");
    }
  };

  const handleRemoveFriend = async () => {
    if (!existingFriendshipId || !targetUserId || targetUserId === user?.id) return;
    const previousStatus = friendStatus ?? "friends";
    setStatusOverride("not_friends");
    try {
      await removeFriend.mutateAsync(existingFriendshipId);
      toastSuccess("Friend removed");
      void friendStatusesQuery.refetch();
    } catch (error) {
      setStatusOverride(previousStatus);
      toastError((error as Error).message || "Couldn’t remove friend.");
    }
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Profile"
        title={profileName}
        actions={friendStatus === "not_friends" ? (
          <Button
            type="button"
            size="sm"
            className="min-h-9 rounded-full px-3.5"
            onClick={() => void handleAddFriend()}
            disabled={sendFriendRequest.isPending}
          >
            {sendFriendRequest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus2 className="h-3.5 w-3.5" />}
            Add friend
          </Button>
        ) : friendStatus === "friends" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9 rounded-full px-3.5"
            onClick={() => void handleRemoveFriend()}
            disabled={removeFriend.isPending || !existingFriendshipId}
          >
            {removeFriend.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />}
            Unfriend
          </Button>
        ) : null}
        meta={(
          <>
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 shrink-0">
                {avatarUrl ? <AvatarImage src={resolveAssetUrl(avatarUrl) ?? avatarUrl} alt={profileName} /> : null}
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {initials(profileName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <span className="block truncate">@{profile?.username || username}</span>
                {member ? <span className="block">{member.role === "owner" ? "Owner" : "Member"} · {formatJoined(member.joinedAt)}</span> : null}
                {friendStatus === "pending_outgoing" ? (
                  <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Friend request sent</span>
                ) : friendStatus === "pending_incoming" ? (
                  <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-300">Friend request pending</span>
                ) : null}
              </div>
            </div>
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {profileQuery.isLoading ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            Loading profile...
          </div>
        ) : profileQuery.isError || !profile ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Could not load this profile.
          </div>
        ) : (
          <>
            <PanelSection title="About" variant="list">
              <p className="text-sm leading-6 text-foreground/90">
                {profile.bio?.trim() ? profile.bio : "No bio yet."}
              </p>
            </PanelSection>

            <PanelSection title="Snapshot" variant="list">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Plans</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{profileQuery.data?.stats.eventsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Friends</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{profileQuery.data?.stats.friendsCount ?? 0}</p>
                </div>
                <div className="rounded-xl bg-muted/40 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Spent</p>
                  <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">€ {Number(profileQuery.data?.stats.totalSpent ?? 0).toFixed(0)}</p>
                </div>
              </div>
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default MemberProfilePanel;
