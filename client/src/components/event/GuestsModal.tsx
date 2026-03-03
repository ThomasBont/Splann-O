import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, UserPlus2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonLine } from "@/components/ui/load-states";
import { useAppToast } from "@/hooks/use-app-toast";
import type { UseEventGuestsResult } from "@/hooks/use-event-guests";
import { type FriendRelationshipStatus, useFriendStatuses, useSearchUsers, useSendFriendRequestByUserId } from "@/hooks/use-friends";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useAuth } from "@/hooks/use-auth";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type GuestsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guests: UseEventGuestsResult;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
  const diffDays = Math.round(diffHours / 24);
  return rtf.format(diffDays, "day");
}

export function GuestsModal({ open, onOpenChange, guests }: GuestsModalProps) {
  const { toastError, toastInfo, toastSuccess } = useAppToast();
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "profile">("list");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, FriendRelationshipStatus>>({});
  const [addingFriendUserId, setAddingFriendUserId] = useState<number | null>(null);
  const {
    members,
    invitesPending,
    loading,
    error,
    refresh,
    revokeInvite,
    addMember,
    revokeMutating,
    addMemberMutating,
  } = guests;
  const userSearch = useSearchUsers(debouncedSearch);
  const addFriendByUserId = useSendFriendRequestByUserId();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (open) return;
    setView("list");
    setSelectedMemberId(null);
    setSearchInput("");
    setDebouncedSearch("");
    setStatusOverrides({});
  }, [open]);

  const hasMembers = members.length > 0;
  const orderedMembers = useMemo(() => {
    if (!user?.id) return members;
    const mine = members.filter((member) => member.userId === user.id);
    const others = members.filter((member) => member.userId !== user.id);
    return [...mine, ...others];
  }, [members, user?.id]);
  const hasInvites = invitesPending.length > 0;
  const pendingCountLabel = useMemo(() => `${invitesPending.length} pending`, [invitesPending.length]);
  const selectedMember = useMemo(
    () => members.find((member) => String(member.userId) === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const pendingInviteUsersById = useMemo(() => {
    const entries = invitesPending
      .filter((invite) => invite.invitee && typeof invite.invitee.userId === "number")
      .map((invite) => [invite.invitee!.userId, invite.invitee!] as const);
    return new Map(entries);
  }, [invitesPending]);
  const selectedProfile = useMemo(() => {
    if (selectedMember) return selectedMember;
    if (!selectedMemberId) return null;
    const pendingInviteUser = pendingInviteUsersById.get(Number(selectedMemberId));
    if (!pendingInviteUser) return null;
    return {
      userId: pendingInviteUser.userId,
      name: pendingInviteUser.name,
      username: pendingInviteUser.username ?? null,
      avatarUrl: pendingInviteUser.avatarUrl ?? null,
      role: "pending",
      joinedAt: null,
    };
  }, [pendingInviteUsersById, selectedMember, selectedMemberId]);
  const profileQuery = useUserProfile(view === "profile" ? (selectedProfile?.username ?? null) : null);

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId);
      toastSuccess("Invite revoked");
      await refresh();
    } catch (err) {
      toastError((err as Error).message || "Couldn’t revoke invite.");
    }
  };

  const handleAddMember = async (userId: number, displayName: string) => {
    try {
      await addMember(userId);
      toastSuccess(`Invited ${displayName} to the plan`);
      setSearchInput("");
      setDebouncedSearch("");
      await refresh();
    } catch (err) {
      console.error("[guests] add member failed", err);
      const e = err as Error & { status?: number; code?: string };
      if (import.meta.env.DEV) {
        const details = [e.status ? `HTTP ${e.status}` : null, e.code, e.message].filter(Boolean).join(" · ");
        toastError(details || "Couldn’t add member.");
      } else {
        toastError(e.message || "Couldn’t add member.");
      }
    }
  };

  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const pendingInviteUserIds = useMemo(
    () => new Set(invitesPending.map((invite) => invite.inviteeUserId).filter((id): id is number => typeof id === "number")),
    [invitesPending],
  );
  const openProfileView = (userId: number) => {
    setSelectedMemberId(String(userId));
    setView("profile");
  };
  const pendingUserInvites = useMemo(
    () => invitesPending.filter((invite) => invite.inviteeUserId && invite.invitee),
    [invitesPending],
  );
  const statusUserIds = useMemo(() => {
    const ids = new Set<number>();
    members.forEach((member) => {
      const memberUserId = Number(member.userId);
      if (!Number.isInteger(memberUserId) || memberUserId <= 0) return;
      if (memberUserId !== user?.id) ids.add(memberUserId);
    });
    if (selectedMemberId) {
      const id = Number(selectedMemberId);
      if (Number.isInteger(id) && id > 0 && id !== user?.id) ids.add(id);
    }
    return Array.from(ids);
  }, [members, selectedMemberId, user?.id]);
  const friendStatusesQuery = useFriendStatuses(statusUserIds);
  const getFriendStatus = (targetUserId: number | null | undefined): FriendRelationshipStatus | null => {
    if (!targetUserId || targetUserId === user?.id) return null;
    const key = String(targetUserId);
    return statusOverrides[key] ?? friendStatusesQuery.data?.[key] ?? "not_friends";
  };
  const selectedMemberStatus = getFriendStatus(selectedProfile?.userId);

  const handleAddFriend = async (targetUserId: number) => {
    const key = String(targetUserId);
    const previous = statusOverrides[key] ?? friendStatusesQuery.data?.[key] ?? "not_friends";
    setStatusOverrides((prev) => ({ ...prev, [key]: "pending_outgoing" }));
    setAddingFriendUserId(targetUserId);
    try {
      const response = await addFriendByUserId.mutateAsync(targetUserId);
      const status = response.status ?? "pending_outgoing";
      setStatusOverrides((prev) => ({ ...prev, [key]: status }));
      if (status === "friends") toastInfo("Already friends");
      else toastSuccess("Friend request sent");
      void friendStatusesQuery.refetch();
    } catch (err) {
      setStatusOverrides((prev) => ({ ...prev, [key]: previous }));
      toastError((err as Error).message || "Couldn’t send friend request.");
    } finally {
      setAddingFriendUserId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-border bg-background p-0 shadow-xl"
      >
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle className="text-lg font-semibold text-foreground">Crew</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground">
                      Manage people and invites
                    </SheetDescription>
                  </SheetHeader>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {view === "profile" ? (
                <div className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    onClick={() => {
                      setView("list");
                      setSelectedMemberId(null);
                    }}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to members
                  </Button>

                  {selectedProfile ? (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {initials(selectedProfile.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-foreground">{selectedProfile.name}</p>
                          {selectedProfile.username ? (
                            <p className="text-sm text-muted-foreground">@{selectedProfile.username}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">No username available</p>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <p className="text-sm text-muted-foreground">Member not found.</p>
                    </section>
                  )}

                  {profileQuery.isLoading ? (
                    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
                      <SkeletonLine className="h-5 w-1/3 rounded-lg" />
                      <SkeletonLine className="h-4 w-2/3 rounded-lg" />
                      <SkeletonLine className="h-4 w-1/2 rounded-lg" />
                    </section>
                  ) : profileQuery.isError ? (
                    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      Couldn’t load profile details.
                      <button
                        type="button"
                        className="ml-1 underline"
                        onClick={() => {
                          void profileQuery.refetch();
                        }}
                      >
                        Retry
                      </button>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <h3 className="text-sm font-semibold text-foreground">Profile details</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">Role</span>
                          <span className="font-medium text-foreground">{selectedProfile?.role ?? "member"}</span>
                        </div>
                        {selectedProfile?.joinedAt ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Joined</span>
                            <span className="font-medium text-foreground">{formatRelativeTime(selectedProfile.joinedAt)}</span>
                          </div>
                        ) : null}
                        {profileQuery.data?.user?.displayName ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Display name</span>
                            <span className="truncate font-medium text-foreground">{profileQuery.data.user.displayName}</span>
                          </div>
                        ) : null}
                        {profileQuery.data?.user?.bio ? (
                          <div className="pt-1">
                            <p className="text-muted-foreground">Bio</p>
                            <p className="mt-1 text-foreground/90">{profileQuery.data.user.bio}</p>
                          </div>
                        ) : null}
                      </div>
                      {selectedProfile?.userId && selectedProfile.userId !== user?.id ? (
                        <div className="mt-4 border-t border-border pt-3">
                          {selectedMemberStatus === "not_friends" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleAddFriend(selectedProfile.userId)}
                              disabled={addFriendByUserId.isPending}
                            >
                              {addFriendByUserId.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                              Add friend
                            </Button>
                          ) : selectedMemberStatus === "friends" ? (
                            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                              Friends
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                              Request sent
                            </span>
                          )}
                        </div>
                      ) : null}
                    </section>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Couldn’t load crew right now. <button type="button" className="underline" onClick={() => void refresh()}>Retry</button>
          </div>
        ) : null}

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Add people</h3>
          </div>
          <div className="space-y-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Splanno users…"
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            />
            {debouncedSearch.length >= 2 ? (
              userSearch.isLoading ? (
                <div className="space-y-2 pt-1">
                  <SkeletonLine className="h-9 rounded-xl" />
                  <SkeletonLine className="h-9 rounded-xl" />
                </div>
              ) : userSearch.data && userSearch.data.length > 0 ? (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background/40 p-1">
                  {userSearch.data.slice(0, 10).map((user: { id: number; displayName?: string | null; username: string; avatarUrl?: string | null }) => {
                    const alreadyMember = memberIds.has(user.id);
                    const alreadyInvited = pendingInviteUserIds.has(user.id);
                    const label = user.displayName || user.username;
                    return (
                      <div key={`search-user-${user.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-foreground">{label}</p>
                          <p className="text-[11px] text-muted-foreground">@{user.username}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={alreadyMember || alreadyInvited || addMemberMutating}
                          onClick={() => void handleAddMember(user.id, label)}
                        >
                          {alreadyMember ? "In group" : alreadyInvited ? "Invited" : "Invite"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No users found.</p>
              )
            ) : (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Members</h3>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{members.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <SkeletonLine className="h-10 rounded-xl" />
              <SkeletonLine className="h-10 rounded-xl" />
              <SkeletonLine className="h-10 rounded-xl" />
            </div>
          ) : hasMembers ? (
            <div className="space-y-2">
              {orderedMembers.map((member) => {
                const relationStatus = getFriendStatus(member.userId);
                const isSelf = member.userId === user?.id;
                return (
                  <button
                    key={`member-${member.userId}`}
                    type="button"
                    onClick={() => openProfileView(member.userId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openProfileView(member.userId);
                      }
                    }}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {initials(member.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{member.name}</p>
                        {member.username ? <p className="text-[11px] text-muted-foreground">@{member.username}</p> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isSelf ? (
                        <span className="inline-flex h-7 items-center rounded-full border border-border bg-muted px-2 text-xs text-muted-foreground">
                          You
                        </span>
                      ) : relationStatus === "friends" ? (
                        <span className="inline-flex h-7 items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 text-xs text-emerald-700 dark:text-emerald-300">
                          Friend
                        </span>
                      ) : relationStatus === "not_friends" ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center rounded-full border border-destructive/40 bg-destructive/10 px-2 text-xs text-destructive transition-colors hover:bg-destructive/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-70"
                          disabled={addingFriendUserId === member.userId || addFriendByUserId.isPending}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void handleAddFriend(member.userId);
                          }}
                        >
                          {addingFriendUserId === member.userId ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                          Add
                        </button>
                      ) : (
                        <span className="inline-flex h-7 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 text-xs text-amber-700 dark:text-amber-300">
                          Pending
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
              ) : (
            <p className="text-sm text-muted-foreground">Invite your circle to get this plan moving.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Pending invites</h3>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{pendingCountLabel}</span>
          </div>
          {hasInvites ? (
            <div className="space-y-2">
              {pendingUserInvites.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">People invited</p>
                  {pendingUserInvites.map((invite) => (
                    <div key={`pending-user-invite-${invite.id}`} className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openProfileView(Number(invite.inviteeUserId))}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {initials(invite.invitee?.name || "User")}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-foreground">{invite.invitee?.name || "Unknown user"}</span>
                            {invite.invitee?.username ? <span className="block text-[11px] text-muted-foreground">@{invite.invitee.username}</span> : null}
                          </span>
                        </button>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Pending</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] text-muted-foreground">sent {formatRelativeTime(invite.createdAt)}</p>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void handleRevokeInvite(invite.id)} disabled={revokeMutating}>
                          <XCircle className="mr-1 h-3.5 w-3.5" /> Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pending invites.</p>
              )}

            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          )}
        </section>

                </div>
              )}
            </div>

            <footer className="border-t border-border bg-background px-5 py-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </footer>
          </div>
      </SheetContent>
    </Sheet>
  );
}

export default GuestsModal;
