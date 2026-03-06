import { UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PlanInviteNotification } from "@/hooks/use-bbq-data";

type FriendRequestNotification = {
  friendshipId: number;
  userId: number;
  username: string;
  displayName: string | null;
  status: string;
};

type NotificationsDrawerProps = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  pendingFriendRequests: FriendRequestNotification[];
  pendingPlanInvites: PlanInviteNotification[];
  acceptFriendPending: boolean;
  declineFriendPending: boolean;
  acceptPlanPending: boolean;
  declinePlanPending: boolean;
  onAcceptFriend: (friendshipId: number) => void;
  onDeclineFriend: (friendshipId: number) => void;
  onAcceptPlan: (invite: PlanInviteNotification) => void;
  onDeclinePlan: (inviteId: string) => void;
};

export default function NotificationsDrawer({
  open,
  onOpenChange,
  pendingFriendRequests,
  pendingPlanInvites,
  acceptFriendPending,
  declineFriendPending,
  acceptPlanPending,
  declinePlanPending,
  onAcceptFriend,
  onDeclineFriend,
  onAcceptPlan,
  onDeclinePlan,
}: NotificationsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Notifications</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
                Friend requests and plan invites
              </SheetDescription>
            </SheetHeader>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Friend requests</h3>
              <div className="mt-3 space-y-2">
                {pendingFriendRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No friend requests</p>
                ) : (
                  pendingFriendRequests.map((request) => {
                    const displayName = request.displayName || request.username;
                    return (
                      <div key={request.friendshipId} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {(displayName[0] || "?").toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">{displayName}</p>
                            <p className="text-[11px] text-muted-foreground">@{request.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={acceptFriendPending}
                            onClick={() => onAcceptFriend(request.friendshipId)}
                          >
                            <UserCheck className="w-3.5 h-3.5 text-green-500" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={declineFriendPending}
                            onClick={() => onDeclineFriend(request.friendshipId)}
                          >
                            <UserX className="w-3.5 h-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Plan invites</h3>
              <div className="mt-3 space-y-2">
                {pendingPlanInvites.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No plan invites</p>
                ) : (
                  pendingPlanInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{invite.eventName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {invite.inviterName ? `${invite.inviterName} invited you` : "Pending invite"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={acceptPlanPending}
                          onClick={() => onAcceptPlan(invite)}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-green-500" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={declinePlanPending}
                          onClick={() => onDeclinePlan(invite.id)}
                        >
                          <UserX className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
