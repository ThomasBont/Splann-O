"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, UserPlus2, UserCircle, Heart, Loader2, X } from "lucide-react";
import type { Participant } from "@shared/schema";
import type { FriendInfo } from "@shared/schema";
import { EMPTY_COPY } from "@/lib/emotional-copy";

export interface InviteSheetProps {
  trigger: React.ReactNode;
  /** Invite by username */
  inviteUsername: string;
  onInviteUsernameChange: (v: string) => void;
  onInvite: () => void;
  invitePending: boolean;
  /** i18n */
  title: string;
  inviteLabel: string;
  placeholder: string;
  inviteFromFriends: string;
  pendingInvites: string;
  invited: string;
  /** Data */
  friends: FriendInfo[];
  invitedParticipants: Participant[];
  /** Participant user IDs (to show "invited" for existing members) */
  participantUserIds?: Set<number>;
  /** Invite friend by username */
  onInviteFriend: (username: string) => void;
  /** Remove/cancel invite */
  onRejectInvite: (participantId: number) => void;
  /** Optional: open profile when clicking a friend's name */
  onViewUser?: (username: string) => void;
}

/**
 * Sheet/drawer for inviting people to a private event.
 */
export function InviteSheet({
  trigger,
  inviteUsername,
  onInviteUsernameChange,
  onInvite,
  invitePending,
  title,
  inviteLabel,
  placeholder,
  inviteFromFriends,
  pendingInvites,
  invited,
  friends,
  invitedParticipants,
  participantUserIds = new Set<number>(),
  onInviteFriend,
  onRejectInvite,
  onViewUser,
}: InviteSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{inviteLabel}</label>
            <div className="flex gap-2">
              <Input
                placeholder={placeholder}
                value={inviteUsername}
                onChange={(e) => onInviteUsernameChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onInvite()}
                data-testid="input-invite-username"
                className="flex-1"
              />
              <Button
                onClick={onInvite}
                disabled={invitePending || !inviteUsername.trim()}
                className="shrink-0"
                data-testid="button-send-invite"
              >
                {invitePending ? <Loader2 className="w-4 h-4 animate-spin" /> : inviteLabel}
              </Button>
            </div>
          </div>

          {friends.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Heart className="w-3 h-3" />
                {inviteFromFriends}
              </p>
              <div className="flex flex-wrap gap-2">
                {friends.map((f) => {
                  const alreadyInvited =
                    invitedParticipants.some((p) => p.userId === f.userId) ||
                    participantUserIds.has(f.userId);
                  return (
                    <div
                      key={f.friendshipId}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-sm"
                      data-testid={`friend-invite-${f.friendshipId}`}
                    >
                      <UserCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      {onViewUser ? (
                        <button
                          type="button"
                          onClick={() => onViewUser(f.username)}
                          className="font-medium truncate max-w-[120px] text-left hover:text-primary hover:underline"
                        >
                          {f.displayName || f.username}
                        </button>
                      ) : (
                        <span className="font-medium truncate max-w-[120px]">
                          {f.displayName || f.username}
                        </span>
                      )}
                      {alreadyInvited ? (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {invited}
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => onInviteFriend(f.username)}
                          disabled={invitePending}
                          data-testid={`button-invite-friend-${f.friendshipId}`}
                        >
                          <UserPlus2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {invitedParticipants.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{pendingInvites}</p>
              <div className="flex flex-wrap gap-2">
                {invitedParticipants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-sm"
                    data-testid={`invited-${p.id}`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{invited}</span>
                    <button
                      onClick={() => onRejectInvite(p.id)}
                      className="text-muted-foreground hover:text-destructive ml-0.5 shrink-0"
                      title="Remove"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {friends.length === 0 && invitedParticipants.length === 0 && inviteUsername === "" && (
            <p className="text-sm text-muted-foreground">
              {EMPTY_COPY.privatePeopleBody}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
