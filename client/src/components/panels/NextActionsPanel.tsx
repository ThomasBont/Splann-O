import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useEventGuests } from "@/hooks/use-event-guests";
import { apiRequest } from "@/lib/api";
import { getClientPlanStatus } from "@/lib/plan-lifecycle";
import { queryKeys } from "@/lib/query-keys";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { deriveSplannoBuddyPanelModel, type SplannoBuddyAction } from "@/lib/splanno-buddy";
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

export function SplannoAssistantPanel() {
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const guests = useEventGuests(eventId);
  const plan = planQuery.data;
  const planStatus = getClientPlanStatus(plan?.status);
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const pendingInvites = guests.invitesPending;
  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: queryKeys.plans.settlementLatest(eventId),
    queryFn: async () => {
      if (!eventId) return { settlement: null, transfers: [] };
      return apiRequest<SettlementResponse>(`/api/events/${eventId}/settlement/latest`);
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

  useEffect(() => {
    if (planStatus !== "archived") return;
    replacePanel({ type: "overview" });
  }, [planStatus, replacePanel]);

  const openAddExpenseFlow = () => {
    if (!eventId) return;
    replacePanel({ type: "add-expense", source: "overview" });
  };

  const buddyModel = useMemo(() => deriveSplannoBuddyPanelModel({
    expenseCount: expenses.length,
    participantCount: participants.length,
    pendingCount: pendingInvites.length,
    planStatus: plan?.status ?? null,
    canSettle: settlements.length > 0,
    hasActiveSettlement: latestSettlement?.status === "active",
    unpaidTransfers,
    eventDate: plan?.date ?? null,
    isCreator,
    settledAt: plan?.settledAt ?? null,
    createdAt: plan?.createdAt ?? null,
  }), [
    expenses.length,
    isCreator,
    latestSettlement?.status,
    participants.length,
    pendingInvites.length,
    plan?.createdAt,
    plan?.date,
    plan?.settledAt,
    plan?.status,
    settlements.length,
    unpaidTransfers,
  ]);
  const handleAction = (action: SplannoBuddyAction) => {
    switch (action.intent) {
      case "overview":
        replacePanel({ type: "overview" });
        break;
      case "expenses":
        replacePanel({ type: "expenses" });
        break;
      case "crew":
        replacePanel({ type: "crew" });
        break;
      case "invite":
        replacePanel({ type: "invite", source: "overview" });
        break;
      case "settlement":
        replacePanel({ type: "settlement" });
        break;
      case "add-expense":
        openAddExpenseFlow();
        break;
      case "plan-details":
        replacePanel({ type: "plan-details" });
        break;
      case "chat":
        replacePanel({ type: "overview" });
        break;
      default:
        break;
    }
  };

  if (planStatus === "archived") {
    return null;
  }

  return (
    <PanelShell>
      <PanelHeader title="Splann-O" />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-5 text-sm text-muted-foreground">
            Open a plan chat to see what Splann-O is tracking for the group.
          </div>
        ) : planQuery.isLoading || crewQuery.isLoading || expensesQuery.isLoading || guests.loading || latestSettlementQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading assistant…
          </div>
        ) : (
          <div className="space-y-4">
            <PanelSection title="Summary" variant="workflow">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className={cn(
                    "inline-flex h-10 w-10 items-center justify-center rounded-full",
                    buddyModel.intent === "resolve"
                      ? "bg-amber-500/14 text-amber-700 dark:text-amber-300"
                      : buddyModel.intent === "warn"
                        ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                        : buddyModel.intent === "celebrate"
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-primary/12 text-primary",
                  )}>
                    <Sparkles className="h-4.5 w-4.5" />
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold tracking-tight text-foreground">{buddyModel.title}</p>
                      <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {buddyModel.intent === "resolve"
                          ? "Resolve"
                          : buddyModel.intent === "warn"
                            ? "Attention"
                            : buddyModel.intent === "celebrate"
                              ? "Milestone"
                              : "Guide"}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{buddyModel.summary}</p>
                  </div>
                </div>
              </div>
            </PanelSection>
            <PanelSection title="What matters most" variant="default">
              <div className="space-y-2.5">
                {buddyModel.primaryAttention ? (
                  <div className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
                    <p className="text-sm font-medium text-foreground">{buddyModel.primaryAttention}</p>
                  </div>
                ) : buddyModel.attention.length > 0 ? buddyModel.attention.map((item) => (
                  <div key={item} className="rounded-xl border border-border/60 bg-background/70 px-3 py-3">
                    <p className="text-sm text-foreground">{item}</p>
                  </div>
                )) : (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Nothing urgent right now
                  </div>
                )}
              </div>
            </PanelSection>
            <PanelSection title="Do next" variant="default">
              <div className="flex flex-wrap gap-2">
                {buddyModel.actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    variant={action.variant === "secondary" ? "outline" : action.variant === "ghost" ? "ghost" : "default"}
                    className={cn(
                      "rounded-full",
                      action.variant === "primary" && "bg-primary text-slate-900 hover:bg-primary/90",
                    )}
                    onClick={() => handleAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </PanelSection>
            <PanelSection title="Supporting context" variant="default">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {buddyModel.stats.map((stat) => (
                    <span
                      key={`${stat.label}-${stat.value}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground"
                    >
                      <span>{stat.label}</span>
                      <span className="text-foreground">{stat.value}</span>
                    </span>
                  ))}
                </div>
                {buddyModel.attention.length > 1 ? (
                  <div className="space-y-2.5">
                    {buddyModel.attention.slice(1).map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {buddyModel.milestones.length > 0 ? (
                  <div className="space-y-2.5">
                    {buddyModel.milestones.map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </PanelSection>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

export default SplannoAssistantPanel;
