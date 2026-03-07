import { useEffect, useMemo, useRef, useState } from "react";
import { CopyPlus, Loader2, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InviteLink } from "@/components/events/invite-link";
import { useAppToast } from "@/hooks/use-app-toast";
import { useEnsureInviteToken } from "@/hooks/use-bbq-data";
import { usePlan } from "@/hooks/use-plan-data";
import { useEventGuests } from "@/hooks/use-event-guests";
import { useSearchUsers } from "@/hooks/use-friends";
import { useAuth } from "@/hooks/use-auth";
import type { EventInviteView } from "@/hooks/use-participants";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { resolveAssetUrl } from "@/lib/asset-url";

type UserSearchRow = {
  id: number;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

const DEFAULT_PUBLIC_APP_ORIGIN = "https://ortega-asado-tracker.onrender.com";

function resolvePublicAppOrigin() {
  const configured = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN ?? "").trim();
  const base = configured || DEFAULT_PUBLIC_APP_ORIGIN;
  return base.replace(/\/+$/, "");
}

function buildInviteUrl(token?: string | null) {
  if (!token) return "";
  return `${resolvePublicAppOrigin()}/join/${token}`;
}

export function InviteFlowPanel() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const guests = useEventGuests(eventId);
  const ensureInviteToken = useEnsureInviteToken();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const localInvitedSetRef = useRef<Set<number>>(new Set());
  const plan = planQuery.data;
  const pendingInvites = guests.invitesPending;
  const userSearch = useSearchUsers(debouncedSearch);
  const inviteUrl = useMemo(() => buildInviteUrl(plan?.inviteToken), [plan?.inviteToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (dropdownRef.current.contains(event.target as Node)) return;
      setIsDropdownOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch, userSearch.data]);

  const ensureTokenAndBuildUrl = async () => {
    if (!eventId) return null;
    try {
      const next = await ensureInviteToken.mutateAsync(eventId);
      return buildInviteUrl(next.inviteToken);
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not prepare invite link.");
      return null;
    }
  };

  const memberUserIds = useMemo(
    () => new Set(guests.members.map((member) => Number(member.userId)).filter((id) => Number.isFinite(id) && id > 0)),
    [guests.members],
  );
  const pendingInviteUserIds = useMemo(
    () => new Set(pendingInvites.map((invite) => Number(invite.inviteeUserId)).filter((id) => Number.isFinite(id) && id > 0)),
    [pendingInvites],
  );
  const filteredResults = useMemo(() => {
    const rows = (userSearch.data ?? []) as UserSearchRow[];
    return rows.filter((row) => {
      if (!row || !Number.isFinite(Number(row.id))) return false;
      if (Number(row.id) === Number(user?.id)) return false;
      if (memberUserIds.has(row.id)) return false;
      if (pendingInviteUserIds.has(row.id)) return false;
      if (localInvitedSetRef.current.has(row.id)) return false;
      return true;
    });
  }, [memberUserIds, pendingInviteUserIds, user?.id, userSearch.data]);

  const inviteUserDirectly = async (target: UserSearchRow) => {
    if (!eventId) return;
    const userId = Number(target.id);
    if (!Number.isFinite(userId) || userId <= 0) return;

    const queryKey = ["/api/events", eventId, "invites", "pending"] as const;
    const previous = queryClient.getQueryData<EventInviteView[]>(queryKey) ?? [];
    const tempId = `temp-invite-${userId}-${Date.now()}`;

    const optimisticInvite: EventInviteView = {
      id: tempId,
      status: "pending",
      inviteType: "user",
      inviteeUserId: userId,
      createdAt: new Date().toISOString(),
      invitee: {
        userId,
        name: target.displayName || target.username,
        username: target.username || null,
        avatarUrl: target.avatarUrl ?? null,
      },
    };

    setInvitingUserId(userId);
    localInvitedSetRef.current.add(userId);
    queryClient.setQueryData<EventInviteView[]>(queryKey, [optimisticInvite, ...previous]);

    try {
      await guests.createInvite({ userId });
      toastSuccess(`Invited ${target.displayName || target.username}`);
      setSearchInput("");
      setDebouncedSearch("");
      setIsDropdownOpen(false);
      await guests.refresh();
    } catch (error) {
      localInvitedSetRef.current.delete(userId);
      queryClient.setQueryData<EventInviteView[]>(queryKey, previous);
      toastError(error instanceof Error ? error.message : "Could not send invite.");
    } finally {
      setInvitingUserId(null);
    }
  };

  const renderSearchContent = () => {
    if (debouncedSearch.length < 2) {
      return <p className="px-1 py-2 text-xs text-muted-foreground">Search for a friend already on Splanno</p>;
    }
    if (userSearch.isLoading) {
      return (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching...
        </div>
      );
    }
    if (userSearch.isError) {
      return <p className="px-1 py-2 text-xs text-destructive">Couldn’t load users</p>;
    }
    if (filteredResults.length === 0) {
      return <p className="px-1 py-2 text-xs text-muted-foreground">No users found</p>;
    }

    return filteredResults.slice(0, 8).map((result, index) => {
      const displayName = result.displayName || result.username;
      const isHighlighted = index === highlightedIndex;
      const isInviting = invitingUserId === result.id;
      return (
        <div
          key={`invite-search-result-${result.id}`}
          className="flex items-center justify-between gap-2 rounded-xl px-2 py-1.5"
        >
          <div className="min-w-0 flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
              {result.avatarUrl ? <AvatarImage src={resolveAssetUrl(result.avatarUrl) ?? result.avatarUrl} alt={displayName} /> : null}
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {(displayName || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              {result.username ? <p className="truncate text-xs text-muted-foreground">@{result.username}</p> : null}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 rounded-full px-3"
            variant={isHighlighted ? "default" : "outline"}
            disabled={isInviting}
            onClick={() => void inviteUserDirectly(result)}
          >
            {isInviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Invite"}
          </Button>
        </div>
      );
    });
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Invite"
        title="Invite friends"
        meta={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{pendingInvites.length} pending invites</span>}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to invite your friends.
          </div>
        ) : planQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading invite flow...
          </div>
        ) : (
          <>
            <PanelSection title="Add Splanno user" variant="default">
              <p className="mb-3 text-sm text-muted-foreground">
                Search by name or username and invite them directly.
              </p>
              <div ref={dropdownRef} className="relative">
                <Input
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  placeholder="Search by name or username..."
                  className="border-border bg-background"
                  onKeyDown={(event) => {
                    if (!isDropdownOpen) return;
                    const maxIndex = Math.max(0, Math.min(filteredResults.length, 8) - 1);
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setHighlightedIndex((current) => Math.min(current + 1, maxIndex));
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setHighlightedIndex((current) => Math.max(current - 1, 0));
                    } else if (event.key === "Enter" && filteredResults.length > 0) {
                      event.preventDefault();
                      const target = filteredResults[Math.min(highlightedIndex, filteredResults.length - 1)];
                      if (target) void inviteUserDirectly(target);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setIsDropdownOpen(false);
                    }
                  }}
                />
                {isDropdownOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-2xl border border-border/70 bg-popover p-1.5 shadow-lg">
                    {renderSearchContent()}
                  </div>
                ) : null}
              </div>
            </PanelSection>

            <PanelSection title="Share invite link" variant="default">
              <p className="mb-3 text-sm text-muted-foreground">
                Send one link and friends will join this plan directly.
              </p>
              <InviteLink
                url={inviteUrl}
                onEnsureToken={ensureTokenAndBuildUrl}
                label="Invite link"
              />
            </PanelSection>

            <PanelSection title="Pending invites" variant="list">
              {pendingInvites.length > 0 ? (
                <div className="divide-y divide-[hsl(var(--border-subtle))]">
                  {pendingInvites.map((invite) => (
                    <div key={`invite-row-${invite.id}`} className="px-1 py-3 first:pt-0 last:pb-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invite.invitee?.name ?? invite.email ?? "Pending invite"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invite.invitee?.username ? `@${invite.invitee.username}` : "Waiting for response"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pending invites yet.</p>
              )}
            </PanelSection>

            <div className="px-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => replacePanel({ type: "crew" })}
              >
                <CopyPlus className="h-4 w-4" />
                View crew
              </Button>
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default InviteFlowPanel;
