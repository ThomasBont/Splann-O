import { NotesTab } from "@/components/event/NotesTab";
import { PanelHeader, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { useAuth } from "@/hooks/use-auth";
import { usePlanCrew } from "@/hooks/use-plan-data";
import type { Participant } from "@shared/schema";

export default function NotesPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const crewQuery = usePlanCrew(eventId);
  const participants = crewQuery.data?.participants ?? [];
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
          canAddNote={!!myParticipant}
        />
      </div>
    </PanelShell>
  );
}
