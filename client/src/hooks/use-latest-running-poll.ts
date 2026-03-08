import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { usePlanMessages } from "@/hooks/use-plan-data";
import type { PollResponse } from "@/components/event/chat/PollMessage";

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

export function useLatestRunningPoll(eventId: number | null, enabled = true) {
  const messagesQuery = usePlanMessages(eventId);

  const orderedPollIds = useMemo(() => {
    const messages = [...(messagesQuery.data?.messages ?? [])];
    messages.sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });

    const ids = new Set<string>();
    for (const message of messages) {
      const meta = toPollMetadata(message.metadata ?? null);
      if (!meta || ids.has(meta.pollId)) continue;
      ids.add(meta.pollId);
    }
    return Array.from(ids).slice(0, 10);
  }, [messagesQuery.data?.messages]);

  const pollQueries = useQueries({
    queries: orderedPollIds.map((pollId) => ({
      queryKey: ["/api/polls", pollId],
      queryFn: async () => {
        const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load poll");
        return res.json() as Promise<PollResponse>;
      },
      enabled: enabled && !!eventId && !!pollId,
      staleTime: 10_000,
      refetchInterval: (enabled && !!eventId ? 5_000 : false) as number | false,
    })),
  });

  const entries = useMemo(() => {
    return pollQueries
      .map((query, index) => ({ pollId: orderedPollIds[index], data: query.data }))
      .filter((entry): entry is { pollId: string; data: PollResponse } => !!entry.data)
      .sort((left, right) => {
        const leftTime = left.data.poll.createdAt ? new Date(left.data.poll.createdAt).getTime() : 0;
        const rightTime = right.data.poll.createdAt ? new Date(right.data.poll.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });
  }, [orderedPollIds, pollQueries]);

  const latestRunningPoll = useMemo(
    () => entries.find((entry) => !entry.data.poll.isClosed) ?? null,
    [entries],
  );

  return {
    latestRunningPoll,
    loading: (enabled && messagesQuery.isLoading) || pollQueries.some((query) => query.isLoading),
  };
}
