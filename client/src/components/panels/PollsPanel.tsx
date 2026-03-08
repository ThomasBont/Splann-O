import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PollMessage, type PollResponse } from "@/components/event/chat/PollMessage";
import { usePlan, usePlanMessages } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";

type PollMetadata = {
  type: "poll";
  pollId: string;
};

function toPollMetadata(input: Record<string, unknown> | null | undefined): PollMetadata | null {
  if (!input || input.type !== "poll") return null;
  const pollId = String(input.pollId ?? "").trim();
  if (!pollId) return null;
  return {
    type: "poll",
    pollId,
  };
}

export function PollsPanel() {
  const eventId = useActiveEventId();
  const { openPanel } = usePanel();
  const planQuery = usePlan(eventId);
  const messagesQuery = usePlanMessages(eventId);

  const pollIds = useMemo(() => {
    const ids = new Set<string>();
    for (const message of messagesQuery.data?.messages ?? []) {
      const meta = toPollMetadata(message.metadata ?? null);
      if (!meta) continue;
      ids.add(meta.pollId);
    }
    return Array.from(ids).reverse().slice(0, 8);
  }, [messagesQuery.data?.messages]);

  const recentPollQueries = useQueries({
    queries: pollIds.map((pollId) => ({
      queryKey: ["/api/polls", pollId],
      queryFn: async () => {
        const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load poll");
        return res.json() as Promise<PollResponse>;
      },
      enabled: !!pollId,
      staleTime: 10_000,
    })),
  });

  const pollEntries = useMemo(() => {
    return recentPollQueries
      .map((query, index) => ({ data: query.data, pollId: pollIds[index] }))
      .filter((entry): entry is { data: PollResponse; pollId: string } => !!entry.data)
      .sort((left, right) => {
        const leftTime = left.data.poll.createdAt ? new Date(left.data.poll.createdAt).getTime() : 0;
        const rightTime = right.data.poll.createdAt ? new Date(right.data.poll.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [pollIds, recentPollQueries]);

  const activePollIds = useMemo(() => {
    return pollEntries
      .filter((entry) => !entry.data.poll.isClosed)
      .map((entry) => entry.pollId);
  }, [pollEntries]);

  const recentClosedPollIds = useMemo(() => {
    return pollEntries
      .filter((entry) => entry.data.poll.isClosed)
      .map((entry) => entry.pollId);
  }, [pollEntries]);

  const recentVotesLoading = messagesQuery.isLoading || recentPollQueries.some((query) => query.isLoading);

  return (
    <PanelShell>
      <PanelHeader
        label="Polls"
        title="Votes"
        meta={(
          <span>
            {planQuery.data?.name ? `See what ${planQuery.data.name} is voting on` : "See active and closed votes"}
          </span>
        )}
        actions={(
          <Button
            type="button"
            className={panelHeaderAddButtonClass()}
            onClick={() => openPanel({ type: "add-poll", source: "polls" })}
          >
            Add Vote +
          </Button>
        )}
      />
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <PanelSection title="Running polls" variant="default">
          {recentVotesLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading votes...
            </div>
          ) : activePollIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No running polls
            </p>
          ) : (
            <div className="space-y-3">
              {activePollIds.map((pollId) => (
                <PollMessage key={`panel-active-poll-${pollId}`} pollId={pollId} />
              ))}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Closed polls" variant="default">
          {recentVotesLoading ? (
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading votes...
            </div>
          ) : recentClosedPollIds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No closed polls yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentClosedPollIds.map((pollId) => (
                <PollMessage key={`panel-poll-${pollId}`} pollId={pollId} />
              ))}
            </div>
          )}
        </PanelSection>
      </div>
    </PanelShell>
  );
}

export default PollsPanel;
