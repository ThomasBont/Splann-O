import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { SkeletonLine } from "@/components/ui/load-states";
import { useEventGuests } from "@/hooks/use-event-guests";
import GuestsModal from "@/components/event/GuestsModal";

type GuestsWidgetProps = {
  eventId: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function GuestsWidget({ eventId }: GuestsWidgetProps) {
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
      <button
        type="button"
        className="group w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-2 hover:ring-slate-200/80 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:ring-neutral-700"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
            <Users className="h-3.5 w-3.5" />
            Crew
          </p>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {members.length}
          </span>
        </div>

        {loading ? (
          <div className="mt-3 space-y-2">
            <SkeletonLine className="h-8 rounded-lg" />
            <SkeletonLine className="h-4 w-1/2 rounded-lg" />
          </div>
        ) : error ? (
          <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">
            Couldn’t load crew. Click to retry.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-center -space-x-2">
              {visibleMembers.map((member) => (
                <span
                  key={`guest-avatar-${member.userId}`}
                  className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-amber-100 text-[11px] font-semibold text-slate-700 dark:border-neutral-900 dark:bg-amber-300/30 dark:text-amber-100"
                  title={member.name}
                >
                  {initials(member.name)}
                </span>
              ))}
              {hiddenCount > 0 ? (
                <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-slate-100 text-[11px] font-semibold text-slate-600 dark:border-neutral-900 dark:bg-neutral-700 dark:text-neutral-200">
                  +{hiddenCount}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-neutral-400">{statusLine}</p>
          </>
        )}
      </button>

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
