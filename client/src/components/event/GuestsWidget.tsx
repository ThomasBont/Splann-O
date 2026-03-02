import { useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeletonLine } from "@/components/ui/load-states";
import { useEventGuests } from "@/hooks/use-event-guests";
import GuestsModal from "@/components/event/GuestsModal";

type GuestsWidgetProps = {
  eventId: number;
  canInvite?: boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function GuestsWidget({ eventId, canInvite = true }: GuestsWidgetProps) {
  const [open, setOpen] = useState(false);
  const guests = useEventGuests(eventId);
  const { members, invitesPending, loading, error, refresh } = guests;

  const visibleMembers = useMemo(() => members.slice(0, 5), [members]);
  const hiddenCount = Math.max(0, members.length - visibleMembers.length);
  const statusLine = invitesPending.length > 0
    ? `${invitesPending.length} invite${invitesPending.length > 1 ? "s" : ""} pending`
    : members.length > 0
      ? "Everyone’s in"
      : "Invite friends to plan together";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="group w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:ring-2 hover:ring-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Crew
          </p>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-medium text-foreground">
              {members.length}
            </span>
            {canInvite ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Add friend to this plan"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            <SkeletonLine className="h-8 rounded-lg" />
            <SkeletonLine className="h-4 w-1/2 rounded-lg" />
          </div>
        ) : error ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Couldn’t load crew. Click to retry.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center -space-x-2">
              {visibleMembers.map((member) => (
                <span
                  key={`guest-avatar-${member.userId}`}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-primary/10 text-[11px] font-semibold text-primary"
                  title={member.name}
                >
                  {initials(member.name)}
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-muted text-[11px] font-semibold text-muted-foreground">
                  +{hiddenCount}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{statusLine}</p>
          </>
        )}
      </div>

      <GuestsModal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) void refresh();
        }}
        guests={guests}
      />
    </>
  );
}

export default GuestsWidget;
