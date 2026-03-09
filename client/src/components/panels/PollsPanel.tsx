import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PollMessage, type PollResponse } from "@/components/event/chat/PollMessage";
import { usePlan, usePlanMessages } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";

const DEFAULT_RUNNING_VISIBLE_COUNT = 2;
const DEFAULT_CLOSED_VISIBLE_COUNT = 3;

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
  const [showAllRunning, setShowAllRunning] = useState(false);
  const [showAllClosed, setShowAllClosed] = useState(false);
  const [pollCollapsedState, setPollCollapsedState] = useState<Record<string, boolean>>({});

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
  const visibleRunningPollIds = showAllRunning ? activePollIds : activePollIds.slice(0, DEFAULT_RUNNING_VISIBLE_COUNT);
  const visibleClosedPollIds = showAllClosed ? recentClosedPollIds : recentClosedPollIds.slice(0, DEFAULT_CLOSED_VISIBLE_COUNT);

  const isPollCollapsed = (pollId: string, section: "running" | "closed", visibleIndex: number) => {
    const explicit = pollCollapsedState[pollId];
    if (typeof explicit === "boolean") return explicit;
    if (section === "running") return visibleIndex !== 0;
    return true;
  };

  const setPollCollapsed = (pollId: string, nextCollapsed: boolean) => {
    setPollCollapsedState((current) => ({ ...current, [pollId]: nextCollapsed }));
  };

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
        <PanelSection title={`Running polls (${activePollIds.length})`} variant="default">
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
              {visibleRunningPollIds.map((pollId, index) => (
                <PollMessage
                  key={`panel-active-poll-${pollId}`}
                  pollId={pollId}
                  collapsible
                  collapsed={isPollCollapsed(pollId, "running", index)}
                  onCollapsedChange={(nextCollapsed) => setPollCollapsed(pollId, nextCollapsed)}
                />
              ))}
              {activePollIds.length > DEFAULT_RUNNING_VISIBLE_COUNT ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllRunning((current) => !current)}
                >
                  {showAllRunning ? "Show less" : `Show more (${activePollIds.length - DEFAULT_RUNNING_VISIBLE_COUNT})`}
                </Button>
              ) : null}
            </div>
          )}
        </PanelSection>

        <PanelSection title={`Closed polls (${recentClosedPollIds.length})`} variant="default">
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
              {visibleClosedPollIds.map((pollId, index) => (
                <PollMessage
                  key={`panel-poll-${pollId}`}
                  pollId={pollId}
                  collapsible
                  collapsed={isPollCollapsed(pollId, "closed", index)}
                  onCollapsedChange={(nextCollapsed) => setPollCollapsed(pollId, nextCollapsed)}
                />
              ))}
              {recentClosedPollIds.length > DEFAULT_CLOSED_VISIBLE_COUNT ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full px-3 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllClosed((current) => !current)}
                >
                  {showAllClosed ? "Show less" : `Show more (${recentClosedPollIds.length - DEFAULT_CLOSED_VISIBLE_COUNT})`}
                </Button>
              ) : null}
            </div>
          )}
        </PanelSection>
      </div>
    </PanelShell>
  );
}

export default PollsPanel;
