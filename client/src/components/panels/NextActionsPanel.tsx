import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useEventGuests } from "@/hooks/use-event-guests";
import { useLatestRunningPoll } from "@/hooks/use-latest-running-poll";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import { queryKeys } from "@/lib/query-keys";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { getUpNext, getUpNextCandidates, getUpNextRotationIntervalMs } from "@/components/panels/up-next";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

type SettlementResponse = {
  settlement: {
    id: string;
    status: "active" | "completed" | "cancelled";
    currency: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    amount: number;
    paidAt: string | null;
  }>;
};

export function NextActionPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const guests = useEventGuests(eventId);
  const latestRunningPollQuery = useLatestRunningPoll(eventId, !!eventId);
  const [upNextRotationIndex, setUpNextRotationIndex] = useState(0);
  const plan = planQuery.data;
  const planStatus = getClientPlanStatus(plan?.status);
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const pendingInvites = guests.invitesPending;
  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: queryKeys.plans.settlementLatest(eventId),
    queryFn: async () => {
      if (!eventId) return { settlement: null, transfers: [] };
      const res = await fetch(`/api/events/${eventId}/settlement/latest`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json() as Promise<SettlementResponse>;
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const latestSettlement = latestSettlementQuery.data?.settlement ?? null;
  const unpaidTransfers = useMemo(
    () => (latestSettlementQuery.data?.transfers ?? []).filter((transfer) => !transfer.paidAt).length,
    [latestSettlementQuery.data?.transfers],
  );
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const { settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );

  const upNextContext = {
    participantCount: participants.length,
    expensesCount: expenses.length,
    pendingInvitesCount: pendingInvites.length,
    canSettle: settlements.length > 0,
    latestSettlementStatus: latestSettlement?.status ?? null,
    unpaidTransfers,
    eventDate: plan?.date,
    isCreator,
  };
  const upNextCandidates = useMemo(() => getUpNextCandidates(upNextContext), [
    upNextContext.canSettle,
    upNextContext.eventDate,
    upNextContext.expensesCount,
    upNextContext.isCreator,
    upNextContext.latestSettlementStatus,
    upNextContext.participantCount,
    upNextContext.pendingInvitesCount,
    upNextContext.unpaidTransfers,
  ]);
  const upNext = getUpNext(upNextContext, upNextRotationIndex);
  const latestRunningPoll = latestRunningPollQuery.latestRunningPoll?.data ?? null;
  const latestRunningPollLeadingOption = latestRunningPoll?.options.find((option) => option.isLeading) ?? null;

  useEffect(() => {
    setUpNextRotationIndex(0);
  }, [upNextCandidates.length, eventId]);

  useEffect(() => {
    if (planStatus !== "archived") return;
    replacePanel({ type: "overview" });
  }, [planStatus, replacePanel]);

  useEffect(() => {
    if (upNextCandidates.length <= 1) return;
    const interval = window.setInterval(() => {
      setUpNextRotationIndex((current) => (current + 1) % upNextCandidates.length);
    }, getUpNextRotationIntervalMs());
    return () => window.clearInterval(interval);
  }, [upNextCandidates.length]);

  const openAddExpenseFlow = () => {
    if (!eventId) return;
    replacePanel({ type: "add-expense", source: "overview" });
  };

  const onAction = upNext.action === "settlement"
    ? () => replacePanel({ type: "settlement" })
    : upNext.action === "invite"
      ? () => replacePanel({ type: "invite", source: "overview" })
    : upNext.action === "crew"
      ? () => replacePanel({ type: "crew" })
      : upNext.action === "add-expense"
        ? openAddExpenseFlow
      : upNext.action === "expenses"
        ? () => replacePanel({ type: "expenses" })
        : upNext.action === "plan-details"
          ? () => replacePanel({ type: "plan-details" })
          : null;

  if (planStatus === "archived") {
    return null;
  }

  return (
    <PanelShell>
      <PanelHeader title="Up next" />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-5 text-sm text-muted-foreground">
            Open a plan chat to see what the group should do next.
          </div>
        ) : planQuery.isLoading || crewQuery.isLoading || expensesQuery.isLoading || guests.loading || latestSettlementQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading up next…
          </div>
        ) : (
          <div className="space-y-4">
            <PanelSection title="Up next" variant="workflow">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-base font-semibold tracking-tight text-foreground">{upNext.title}</p>
                    {upNext.description ? (
                      <p className="text-sm leading-6 text-muted-foreground">{upNext.description}</p>
                    ) : null}
                  </div>
                  <div className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    upNext.type === "settlement" ? "bg-yellow-400 shadow-[0_0_0_6px_rgba(250,204,21,0.16)]" :
                    upNext.type === "invite" ? "bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,0.14)]" :
                    upNext.type === "expense" ? "bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]" :
                    upNext.type === "event" ? "bg-violet-400 shadow-[0_0_0_6px_rgba(167,139,250,0.14)]" :
                    "bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,0.14)]",
                  )} />
                </div>
                {upNext.ctaLabel && onAction ? (
                  <Button type="button" onClick={onAction}>
                    {upNext.ctaLabel}
                  </Button>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    All good
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>The highest-priority next step for this plan.</span>
                  {onAction ? <ArrowRight className="h-3.5 w-3.5" /> : null}
                </div>
              </div>
            </PanelSection>
            {latestRunningPoll ? (
              <PanelSection title="Live vote" variant="default">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-700 dark:text-yellow-300">
                        <BarChart3 className="h-3.5 w-3.5" />
                        Running now
                      </div>
                      <p className="mt-2 text-base font-semibold tracking-tight text-foreground">
                        {latestRunningPoll.poll.question}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {latestRunningPoll.totalEligibleVoters
                          ? `${latestRunningPoll.totalVotes} / ${latestRunningPoll.totalEligibleVoters} people voted`
                          : `${latestRunningPoll.totalVotes} vote${latestRunningPoll.totalVotes === 1 ? "" : "s"} so far`}
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => replacePanel({ type: "polls" })}>
                      Open votes
                    </Button>
                  </div>
                  <div className="space-y-2.5">
                    {latestRunningPoll.options.slice(0, 3).map((option) => {
                      const width = latestRunningPoll.totalVotes > 0
                        ? Math.max(8, Math.round((option.voteCount / latestRunningPoll.totalVotes) * 100))
                        : 0;
                      return (
                        <div key={`up-next-live-poll-${option.id}`} className="space-y-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <span className={cn("truncate text-foreground", option.isLeading && "font-semibold")}>
                                {option.label}
                              </span>
                              {option.isLeading ? (
                                <span className="ml-2 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-700">
                                  Leading
                                </span>
                              ) : null}
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                              {option.voteCount}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                            <div
                              className={cn("h-full rounded-full transition-all", option.isLeading ? "bg-yellow-400" : "bg-neutral-300 dark:bg-white/20")}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          {(Array.isArray(option.voters) ? option.voters.length : 0) > 0 ? (
                            <p className="text-[11px] text-muted-foreground">
                              {(Array.isArray(option.voters) ? option.voters : []).slice(0, 3).map((voter) => voter.name.split(/\s+/)[0]).join(", ")}
                              {(Array.isArray(option.voters) ? option.voters.length : 0) > 3 ? ` +${(Array.isArray(option.voters) ? option.voters.length : 0) - 3}` : ""}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {latestRunningPollLeadingOption
                        ? `${latestRunningPollLeadingOption.label} is currently ahead`
                        : "The group is still deciding"}
                    </span>
                  </div>
                </div>
              </PanelSection>
            ) : null}
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export default NextActionPanel;
