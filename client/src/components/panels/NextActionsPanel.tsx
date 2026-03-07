import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useEventGuests } from "@/hooks/use-event-guests";
import { computeSplit } from "@/lib/split/calc";
import { usePanel } from "@/state/panel";
import { getUpNext } from "@/components/panels/up-next";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

type SettlementResponse = {
  settlement: {
    id: string;
    status: "proposed" | "in_progress" | "settled";
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
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const pendingInvites = guests.invitesPending;
  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: ["/api/events", eventId, "settlement", "latest"],
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

  const upNext = getUpNext({
    expensesCount: expenses.length,
    pendingInvitesCount: pendingInvites.length,
    canSettle: settlements.length > 0,
    latestSettlementStatus: latestSettlement?.status ?? null,
    unpaidTransfers,
    eventDate: plan?.date,
    isCreator,
  });

  const onAction = upNext.action === "settlement"
    ? () => replacePanel({ type: "settlement" })
    : upNext.action === "crew"
      ? () => replacePanel({ type: "crew" })
      : upNext.action === "expenses"
        ? () => replacePanel({ type: "expenses" })
        : upNext.action === "plan-details"
          ? () => replacePanel({ type: "plan-details" })
          : null;

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
          <PanelSection title="Up next" variant="workflow">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-base font-semibold tracking-tight text-foreground">{upNext.title}</p>
                {upNext.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">{upNext.description}</p>
                ) : null}
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
        )}
      </div>
    </PanelShell>
  );
}

export default NextActionPanel;
