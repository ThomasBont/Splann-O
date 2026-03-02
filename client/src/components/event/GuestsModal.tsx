import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Loader2, Mail, UserRoundPlus, UserPlus2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SkeletonLine } from "@/components/ui/load-states";
import { useAppToast } from "@/hooks/use-app-toast";
import type { UseEventGuestsResult } from "@/hooks/use-event-guests";
import { useSearchUsers } from "@/hooks/use-friends";
import { useUserProfile } from "@/hooks/use-user-profile";
import { copyText } from "@/lib/copy-text";
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
  const [view, setView] = useState<"list" | "profile">("list");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const {
    members,
    invitesPending,
    loading,
    error,
    refresh,
    createInvite,
    revokeInvite,
    addMember,
    inviteMutating,
    revokeMutating,
    addMemberMutating,
  } = guests;
  const userSearch = useSearchUsers(debouncedSearch);

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
  }, [open]);

  const hasMembers = members.length > 0;
  const hasInvites = invitesPending.length > 0;
  const pendingCountLabel = useMemo(() => `${invitesPending.length} pending`, [invitesPending.length]);
  const selectedMember = useMemo(
    () => members.find((member) => String(member.userId) === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );
  const profileQuery = useUserProfile(view === "profile" ? (selectedMember?.username ?? null) : null);

  const handleSendInvite = async () => {
    try {
      await createInvite({ email: email.trim() || undefined });
      toastSuccess(email.trim() ? "Invite sent" : "Invite created");
      setEmail("");
      await refresh();
    } catch (err) {
      toastError((err as Error).message || "Couldn’t send invite. Try again.");
    }
  };

  const handleCreateLink = async () => {
    try {
      const result = await createInvite({});
      const copied = await copyText(result.inviteUrl);
      if (copied) toastSuccess("Invite link copied");
      else toastInfo("Copy failed — select and copy manually.");
      await refresh();
    } catch (err) {
      toastError((err as Error).message || "Couldn’t create invite link.");
    }
  };

  const handleCopyInviteLink = async (inviteUrl?: string | null) => {
    if (!inviteUrl) return;
    const copied = await copyText(inviteUrl);
    if (copied) toastSuccess("Invite link copied");
    else toastInfo("Copy failed — select and copy manually.");
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId);
      toastSuccess("Invite revoked");
      await refresh();
    } catch (err) {
      toastError((err as Error).message || "Couldn’t revoke invite.");
    }
  };

  const handleResendInvite = async (inviteEmail?: string | null) => {
    if (!inviteEmail) return;
    try {
      await createInvite({ email: inviteEmail });
      toastSuccess("Invite resent");
      await refresh();
    } catch (err) {
      toastError((err as Error).message || "Couldn’t resend invite.");
    }
  };

  const handleAddMember = async (userId: number, displayName: string) => {
    try {
      await addMember(userId);
      toastSuccess(`Added ${displayName} to the plan`);
      setSearchInput("");
      setDebouncedSearch("");
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
  const openProfileView = (memberUserId: number) => {
    setSelectedMemberId(String(memberUserId));
    setView("profile");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Crew</SheetTitle>
                    <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
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

                  {selectedMember ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-sm font-semibold text-slate-700">
                          {initials(selectedMember.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-slate-900">{selectedMember.name}</p>
                          {selectedMember.username ? (
                            <p className="text-sm text-slate-500">@{selectedMember.username}</p>
                          ) : (
                            <p className="text-sm text-slate-500">No username available</p>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">Member not found.</p>
                    </section>
                  )}

                  {profileQuery.isLoading ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
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
                    <section className="rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-semibold text-slate-900">Profile details</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-500">Role</span>
                          <span className="font-medium text-slate-800">{selectedMember?.role ?? "member"}</span>
                        </div>
                        {selectedMember?.joinedAt ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Joined</span>
                            <span className="font-medium text-slate-800">{formatRelativeTime(selectedMember.joinedAt)}</span>
                          </div>
                        ) : null}
                        {profileQuery.data?.user?.displayName ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Display name</span>
                            <span className="font-medium text-slate-800 truncate">{profileQuery.data.user.displayName}</span>
                          </div>
                        ) : null}
                        {profileQuery.data?.user?.bio ? (
                          <div className="pt-1">
                            <p className="text-slate-500">Bio</p>
                            <p className="mt-1 text-slate-700">{profileQuery.data.user.bio}</p>
                          </div>
                        ) : null}
                      </div>
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserPlus2 className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Add people</h3>
          </div>
          <div className="space-y-2">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Splanno users…"
            />
            {debouncedSearch.length >= 2 ? (
              userSearch.isLoading ? (
                <div className="space-y-2 pt-1">
                  <SkeletonLine className="h-9 rounded-xl" />
                  <SkeletonLine className="h-9 rounded-xl" />
                </div>
              ) : userSearch.data && userSearch.data.length > 0 ? (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-1">
                  {userSearch.data.slice(0, 10).map((user: { id: number; displayName?: string | null; username: string; avatarUrl?: string | null }) => {
                    const alreadyMember = memberIds.has(user.id);
                    const label = user.displayName || user.username;
                    return (
                      <div key={`search-user-${user.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800">{label}</p>
                          <p className="text-[11px] text-slate-500">@{user.username}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={alreadyMember || addMemberMutating}
                          onClick={() => void handleAddMember(user.id, label)}
                        >
                          {alreadyMember ? "Added" : "Add"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No users found.</p>
              )
            ) : (
              <p className="text-xs text-slate-500">Type at least 2 characters to search.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Members</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{members.length}</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              <SkeletonLine className="h-10 rounded-xl" />
              <SkeletonLine className="h-10 rounded-xl" />
              <SkeletonLine className="h-10 rounded-xl" />
            </div>
          ) : hasMembers ? (
            <div className="space-y-2">
              {members.map((member) => (
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
                  className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-xs font-semibold text-slate-700">
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{member.name}</p>
                      {member.username ? <p className="text-[11px] text-slate-500">@{member.username}</p> : null}
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">In group</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Invite your circle to get this plan moving.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Pending invites</h3>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">{pendingCountLabel}</span>
          </div>
          {hasInvites ? (
            <div className="space-y-2">
              {invitesPending.map((invite) => (
                <div key={`invite-${invite.id}`} className="rounded-xl border border-slate-200/80 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{invite.email || "Invite link"}</p>
                      <p className="text-[11px] text-slate-500">sent {formatRelativeTime(invite.createdAt)}</p>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">Invite sent</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button type="button" size="sm" variant="ghost" onClick={() => void handleCopyInviteLink(invite.inviteUrl)}>
                      <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                    </Button>
                    {invite.email ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => void handleResendInvite(invite.email)} disabled={inviteMutating}>
                        <Mail className="mr-1 h-3.5 w-3.5" /> Resend
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => void handleRevokeInvite(invite.id)} disabled={revokeMutating}>
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No pending invites.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserRoundPlus className="h-4 w-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Invite</h3>
          </div>
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="friend@example.com (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void handleSendInvite()} disabled={inviteMutating}>
                {inviteMutating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Mail className="mr-1.5 h-4 w-4" />}
                Send invite
              </Button>
              <Button type="button" variant="outline" onClick={() => void handleCreateLink()} disabled={inviteMutating}>
                <Copy className="mr-1.5 h-4 w-4" />
                Create link
              </Button>
            </div>
          </div>
        </section>

                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
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
