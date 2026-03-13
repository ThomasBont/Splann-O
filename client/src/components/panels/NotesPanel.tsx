import { NotesTab } from "@/components/event/NotesTab";
import { PanelHeader, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { useAuth } from "@/hooks/use-auth";
import { usePlan, usePlanCrew } from "@/hooks/use-plan-data";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import type { Participant } from "@shared/schema";

export default function NotesPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const participants = crewQuery.data?.participants ?? [];
  const isArchived = getClientPlanStatus(planQuery.data?.status) === "archived";
  const myParticipant = participants.find(
    (participant: Participant) => participant.userId != null && String(participant.userId) === String(user?.id),
  ) ?? null;

  return (
    <PanelShell>
      <PanelHeader title="Notes" />
      <div className="flex-1 overflow-y-auto p-4">
        <NotesTab
          eventId={eventId}
          myParticipantId={myParticipant?.id ?? null}
          canAddNote={!!myParticipant && !isArchived}
          readOnly={isArchived}
          readOnlyMessage="This plan is archived and read-only. Notes can no longer be changed."
        />
      </div>
    </PanelShell>
  );
}
