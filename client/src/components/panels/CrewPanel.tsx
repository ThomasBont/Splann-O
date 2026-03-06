import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEventGuests } from "@/hooks/use-event-guests";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

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
  const guests = useEventGuests(eventId);
  const { members, invitesPending, loading, error } = guests;

  return (
    <PanelShell>
      <PanelHeader
        label="Crew"
        title="Crew"
        meta={<span className="inline-flex items-center gap-2"><Users className="h-4 w-4" />{members.length} members · {invitesPending.length} pending</span>}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
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
                {members.length > 0 ? members.map((member) => (
                  <div key={`crew-member-${member.userId}`} className="flex items-center gap-3 px-1 py-3 first:pt-0 last:pb-0">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.username ? `@${member.username}` : member.role} · {formatJoined(member.joinedAt)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {member.role}
                    </span>
                  </div>
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

            <div className="flex items-center gap-2 px-1">
              <Button type="button" variant="outline" disabled>
                <Plus className="h-4 w-4" />
                Invite people
              </Button>
              <p className="text-xs text-muted-foreground">Invite flow can be moved into the panel next.</p>
            </div>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default CrewPanel;
