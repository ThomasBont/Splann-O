import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Loader2, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppToast } from "@/hooks/use-app-toast";
import { resolveAssetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";

type PollMessageProps = {
  pollId: string;
  className?: string;
};

export type PollResponse = {
  poll: {
    id: string;
    eventId: number;
    messageId: string;
    createdByUserId: number;
    question: string;
    isClosed: boolean;
    createdAt: string | null;
  };
  options: Array<{
    id: string;
    label: string;
    position: number;
    voteCount: number;
    voters: Array<{
      id: number;
      name: string;
      avatarUrl: string | null;
    }>;
    isLeading: boolean;
    isWinner: boolean;
  }>;
  totalVotes: number;
  totalEligibleVoters: number | null;
  myVoteOptionId: string | null;
  permissions: {
    canVote: boolean;
    canClose: boolean;
  };
};

function normalizePollResponse(input: PollResponse): PollResponse {
  const options = Array.isArray(input.options) ? input.options : [];
  const normalizedOptions = options.map((option) => ({
    ...option,
    voters: Array.isArray(option.voters) ? option.voters : [],
    isLeading: Boolean(option.isLeading),
    isWinner: Boolean(option.isWinner),
  }));
  const totalVotes = typeof input.totalVotes === "number"
    ? input.totalVotes
    : normalizedOptions.reduce((sum, option) => sum + (Number(option.voteCount) || 0), 0);

  return {
    ...input,
    options: normalizedOptions,
    totalVotes,
    totalEligibleVoters: typeof input.totalEligibleVoters === "number" ? input.totalEligibleVoters : null,
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function PollMessage({ pollId, className }: PollMessageProps) {
  const queryClient = useQueryClient();
  const { toastError, toastSuccess } = useAppToast();
  const queryKey = useMemo(() => ["/api/polls", pollId], [pollId]);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const pollQuery = useQuery<PollResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load poll");
      const body = await res.json() as PollResponse;
      return normalizePollResponse(body);
    },
    enabled: !!pollId,
    staleTime: 10_000,
    refetchInterval: 5_000,
  });

  const voteMutation = useMutation({
    mutationFn: async (optionId: string) => {
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ optionId }),
      });
      const body = await res.json().catch(() => ({} as { message?: string; code?: string }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to vote") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as PollResponse;
    },
    onMutate: async (optionId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PollResponse>(queryKey);
      queryClient.setQueryData<PollResponse>(queryKey, (old) => {
        if (!old || old.poll.isClosed) return old;
        const previousOptionId = old.myVoteOptionId;
        const options = old.options.map((option) => {
          let voteCount = option.voteCount;
          if (previousOptionId && previousOptionId !== optionId && option.id === previousOptionId) {
            voteCount = Math.max(0, voteCount - 1);
          }
          if (option.id === optionId && previousOptionId !== optionId) {
            voteCount += 1;
          }
          return { ...option, voteCount, voters: Array.isArray(option.voters) ? option.voters : [] };
        });
        return normalizePollResponse({
          ...old,
          options,
          myVoteOptionId: optionId,
        });
      });
      return { previous };
    },
    onError: (error, _optionId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const err = error as Error & { code?: string };
      if (err.code === "poll_closed") {
        toastError("This poll is closed.");
        return;
      }
      toastError(err.message || "Couldn’t save your vote.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, normalizePollResponse(data));
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/polls/${encodeURIComponent(pollId)}/close`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({} as { message?: string }));
      if (!res.ok) throw new Error(body.message || "Failed to close poll");
      return body as PollResponse;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, normalizePollResponse(data));
      setConfirmCloseOpen(false);
      toastSuccess("Poll closed");
    },
    onError: (error) => {
      toastError(error instanceof Error ? error.message : "Couldn’t close poll.");
    },
  });

  if (pollQuery.isLoading) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950", className)}>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading poll...
        </div>
      </div>
    );
  }

  if (pollQuery.isError || !pollQuery.data) {
    return (
      <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950", className)}>
        <p className="text-sm text-muted-foreground">Couldn’t load poll.</p>
      </div>
    );
  }

  const poll = normalizePollResponse(pollQuery.data);
  const disabled = poll.poll.isClosed || voteMutation.isPending;
  const totalVotes = poll.totalVotes;

  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-950", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <p className="truncate text-sm font-medium text-foreground sm:text-[15px]">{poll.poll.question}</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {poll.poll.isClosed ? "Final results" : "Tap to vote"}
          </p>
          {poll.totalEligibleVoters ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totalVotes} / {poll.totalEligibleVoters} people voted
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-start gap-2">
          {poll.poll.isClosed ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200">
              <Lock className="h-3 w-3" />
              Closed
            </span>
          ) : null}
          {poll.permissions.canClose && !poll.poll.isClosed ? (
            <Popover open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-auto rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                  onClick={(event) => event.stopPropagation()}
                  disabled={closeMutation.isPending}
                >
                  {closeMutation.isPending ? "Closing..." : "Close"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-56 rounded-xl p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Close this vote?</p>
                    <p className="mt-1 text-xs text-muted-foreground">People will only see the final results after closing.</p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => setConfirmCloseOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => closeMutation.mutate()}
                      disabled={closeMutation.isPending}
                    >
                      Close poll
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const selected = poll.myVoteOptionId === option.id;
          const percent = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const voteLabel = `${option.voteCount} vote${option.voteCount === 1 ? "" : "s"}`;
          const isLeading = option.isLeading;
          const isWinner = option.isWinner;
          return (
            <button
              key={option.id}
              type="button"
              className={cn(
                "flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left transition",
                isWinner
                  ? "border-yellow-400 bg-yellow-50 dark:border-yellow-500/50 dark:bg-yellow-500/10"
                  : isLeading
                  ? "border-yellow-300 bg-yellow-50/60 dark:border-yellow-500/40 dark:bg-yellow-500/10"
                  : selected
                  ? "border-yellow-400 bg-yellow-50 dark:border-yellow-500/50 dark:bg-yellow-500/10"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-white/10 dark:hover:bg-white/5",
                disabled && "cursor-default",
              )}
              onClick={() => {
                if (disabled || !poll.permissions.canVote) return;
                voteMutation.mutate(option.id);
              }}
              disabled={disabled || !poll.permissions.canVote}
              >
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2 pr-3">
                  <span className={cn("min-w-0 text-sm text-foreground", (isWinner || isLeading) && "font-semibold")}>
                  {isWinner ? `✓ ${option.label}` : option.label}
                  </span>
                  {isWinner ? (
                    <span className="shrink-0 rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-800">
                      Winner
                    </span>
                  ) : isLeading ? (
                    <span className="shrink-0 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-700">
                      Leading
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{voteLabel}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    (selected || isLeading || isWinner) ? "bg-yellow-400" : "bg-neutral-300 dark:bg-white/20",
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                />
              </div>
              {option.voters.length > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {option.voters.slice(0, 3).map((voter) => (
                      <Avatar key={`${option.id}-voter-${voter.id}`} className="h-5 w-5 border border-white dark:border-neutral-950">
                        {voter.avatarUrl ? (
                          <AvatarImage src={resolveAssetUrl(voter.avatarUrl) ?? voter.avatarUrl} alt={voter.name} />
                        ) : null}
                        <AvatarFallback className="text-[9px] font-semibold">
                          {initials(voter.name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {option.voters.length > 3 ? (
                    <span className="text-[11px] font-medium text-muted-foreground">+{option.voters.length - 3}</span>
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PollMessage;
