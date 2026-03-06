import { useMemo, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventActivityFeed } from "@/components/event/EventActivityFeed";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { getEventActivity } from "@/utils/eventActivity";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

type SettlementResponse = {
  settlement: {
    id: string;
    status: "proposed" | "in_progress" | "settled";
    currency: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    fromName?: string;
    toName?: string;
    amount: number;
    paidAt: string | null;
  }>;
};

function formatCurrency(amount: number, currencyCode?: string | null) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = String(currencyCode ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safeAmount);
    } catch {
      // fall through
    }
  }
  return `€${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function SecondarySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] p-4">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function OverviewPanel() {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError } = useAppToast();
  const { closePanel, replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
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
  });

  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [expenses],
  );
  const { balances, settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const canSettle = settlements.length > 0;
  const latestSettlement = latestSettlementQuery.data?.settlement ?? null;
  const settlementTransfers = latestSettlementQuery.data?.transfers ?? [];
  const paidTransfers = settlementTransfers.filter((transfer) => !!transfer.paidAt).length;
  const myParticipant = user?.id
    ? participants.find((participant: { userId?: number | null }) => participant.userId === user.id) ?? null
    : null;
  const myBalance = myParticipant
    ? balances.find((entry) => entry.id === myParticipant.id) ?? null
    : null;
  const topReceivers = balances
    .filter((entry) => Number(entry.balance) > 0.01)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .slice(0, 3);
  const topDebtors = balances
    .filter((entry) => Number(entry.balance) < -0.01)
    .sort((a, b) => Number(a.balance) - Number(b.balance))
    .slice(0, 3);
  const debtorCount = balances.filter((entry) => Number(entry.balance) < -0.01).length;
  const activityItems = useMemo(() => {
    if (!plan) return [];
    return getEventActivity({
      event: {
        id: Number(plan.id),
        name: plan.name,
        date: plan.date ?? new Date(),
        currency: typeof plan.currency === "string" ? plan.currency : undefined,
        creatorUserId: plan.creatorUserId ?? null,
      },
      expenses: expenses.map((expense) => ({
        id: expense.id,
        item: expense.item,
        amount: expense.amount,
        participantName: expense.participantName ?? undefined,
      })),
      participants,
    });
  }, [plan, expenses, participants]);
  const crewPreview = participants.slice(0, 4);
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const personalStatus = useMemo(() => {
    if (!myParticipant || !myBalance) return { label: "No personal split yet", tone: "muted" as const };
    const amount = Number(myBalance.balance) || 0;
    if (Math.abs(amount) < 0.01) return { label: "All settled", tone: "settled" as const };
    if (amount > 0) return { label: `You are owed ${formatCurrency(amount, currency)}`, tone: "positive" as const };
    return { label: `You owe ${formatCurrency(Math.abs(amount), currency)}`, tone: "negative" as const };
  }, [currency, myBalance, myParticipant]);
  const settlementTitle = latestSettlement
    ? latestSettlement.status === "settled"
      ? "Settlement complete"
      : "Settlement in progress"
    : canSettle
      ? "Ready to settle"
      : "No settlement needed";
  const settlementBody = latestSettlement
    ? latestSettlement.status === "settled"
      ? settlementTransfers.length > 0
        ? `All ${settlementTransfers.length} payments have been marked as paid. Open the settlement to review the final details.`
        : "This settlement has been completed. Open it to review the final details."
      : settlementTransfers.length > 0
        ? `${paidTransfers}/${settlementTransfers.length} payments are marked complete. Open the settlement to see what still needs attention.`
        : "A settlement plan is ready. Open it to review the recommended paybacks."
    : canSettle
      ? isCreator
        ? "The plan is ready to wrap up. Create a settlement plan to turn balances into clear next steps."
        : "The plan looks ready to settle. The creator can start the settlement when everyone is ready."
      : "Nothing urgent here. The group is balanced for now.";
  const startManualSettlement = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/manual`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { message?: string; code?: string }));
        const error = new Error(body.message || "Failed to start settlement") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return res.json() as Promise<{ latest: SettlementResponse }>;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(["/api/events", eventId, "settlement", "latest"], result.latest);
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_creator_can_start_settlement") {
        toastError("Only the plan creator can start settlement.");
        return;
      }
      toastError(err.message || "Couldn’t start settlement.");
    },
  });

  const handleSettlementAction = () => {
    if (latestSettlement) {
      replacePanel({ type: "expenses" });
      return;
    }
    if (!isCreator || !canSettle) return;
    startManualSettlement.mutate();
  };

  const nextAction = useMemo(() => {
    if (expenses.length === 0) {
      return {
        label: "Next action",
        title: "Add the first expense",
        body: "Start tracking shared costs so balances and settlement can take shape.",
        tone: "neutral" as const,
        actionLabel: "Add expense",
        onAction: () => replacePanel({ type: "expenses" }),
      };
    }

    if (latestSettlement) {
      if (latestSettlement.status === "settled") {
        return {
          label: "Next action",
          title: "All settled",
          body: "Every payment has been marked as paid. You can still open the settlement to review the final details.",
          tone: "complete" as const,
          actionLabel: "View settlement",
          onAction: handleSettlementAction,
        };
      }

      const remainingPayments = Math.max(settlementTransfers.length - paidTransfers, 0);
      return {
        label: "Next action",
        title: remainingPayments > 0
          ? `${remainingPayments} payment${remainingPayments === 1 ? "" : "s"} still pending`
          : "Settlement in progress",
        body: "Open the settlement to review what is still outstanding and mark payments as they come in.",
        tone: "warning" as const,
        actionLabel: "View settlement",
        onAction: handleSettlementAction,
      };
    }

    if (canSettle) {
      return {
        label: "Next action",
        title: `${debtorCount} ${debtorCount === 1 ? "person still owes money" : "people still owe money"}`,
        body: isCreator
          ? "Turn the current balances into a settlement plan so everyone knows the next step."
          : "The plan is ready to settle. Open the money details while the creator starts the settlement.",
        tone: "warning" as const,
        actionLabel: isCreator ? "Start settlement" : "Open money details",
        onAction: isCreator ? handleSettlementAction : () => replacePanel({ type: "expenses" }),
      };
    }

    return {
      label: "Next action",
      title: "All settled",
      body: "The group is balanced for now. No urgent next step is needed.",
      tone: "complete" as const,
      actionLabel: expenses.length > 0 ? "Open money details" : null,
      onAction: expenses.length > 0 ? () => replacePanel({ type: "expenses" }) : null,
    };
  }, [
    canSettle,
    debtorCount,
    expenses.length,
    handleSettlementAction,
    isCreator,
    latestSettlement,
    paidTransfers,
    replacePanel,
    settlementTransfers.length,
  ]);

  return (
    <PanelShell>
      <div className="flex items-center justify-between gap-4 border-b border-[hsl(var(--border-subtle))] px-5 py-4">
        <p className="text-sm font-medium tracking-tight text-foreground">Overview</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={closePanel}
          aria-label="Close panel"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to see its overview.
          </div>
        ) : null}

        {eventId && !plan ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Loading plan overview...
          </div>
        ) : null}

        {plan ? (
          <>
            <section className="rounded-3xl border border-[hsl(var(--border-subtle))] bg-[linear-gradient(145deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-7 shadow-[var(--shadow-md)]">
              <div className="flex flex-col gap-5">
                <div className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/70 px-4 py-4 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{nextAction.label}</p>
                      <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">{nextAction.title}</h3>
                      <p className="mt-1.5 max-w-[28rem] text-sm leading-6 text-muted-foreground">{nextAction.body}</p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide",
                      nextAction.tone === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                      nextAction.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
                      nextAction.tone === "neutral" && "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-muted-foreground",
                    )}>
                      {nextAction.tone === "complete" ? "Done" : nextAction.tone === "warning" ? "Pending" : "Start"}
                    </span>
                  </div>
                  {nextAction.actionLabel && nextAction.onAction ? (
                    <div className="mt-4">
                      <Button type="button" size="sm" onClick={nextAction.onAction}>
                        {nextAction.actionLabel}
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div>
                  <p className="text-[2.85rem] font-semibold leading-none tracking-tight text-foreground">
                    {formatCurrency(totalShared, currency)}
                  </p>
                  <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground">
                    {participants.length} people · {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className={cn(
                  "inline-flex w-fit items-center rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm",
                  personalStatus.tone === "positive" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300",
                  personalStatus.tone === "negative" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200",
                  personalStatus.tone === "settled" && "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200",
                  personalStatus.tone === "muted" && "border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] text-muted-foreground",
                )}>
                  {personalStatus.label}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[linear-gradient(180deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Settlement</p>
                  <h3 className="mt-2.5 text-lg font-semibold tracking-tight text-foreground">{settlementTitle}</h3>
                  <p className="mt-3 max-w-[28rem] text-sm leading-6 text-muted-foreground">{settlementBody}</p>
                </div>
                {latestSettlement ? (
                  <span className="rounded-full border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-foreground/80">
                    {latestSettlement.status.replace("_", " ")}
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex items-center gap-2">
                {latestSettlement ? (
                  <Button type="button" onClick={handleSettlementAction}>
                    View settlement
                  </Button>
                ) : isCreator && canSettle ? (
                  <Button type="button" onClick={handleSettlementAction} disabled={startManualSettlement.isPending}>
                    {startManualSettlement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create settlement plan
                  </Button>
                ) : null}
                {!isCreator && canSettle ? (
                  <span className="text-xs text-muted-foreground">Only the creator can start settlement.</span>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Money snapshot</h3>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto gap-1 px-0 text-sm font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => replacePanel({ type: "expenses" })}
                >
                  Open money details
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] p-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Top receivers</p>
                  <div className="mt-2.5 space-y-2">
                    {topReceivers.length > 0 ? topReceivers.map((entry) => (
                      <div key={`receiver-${entry.id}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-foreground">{entry.name}</span>
                        <span className="font-medium text-emerald-700 dark:text-emerald-300">{formatCurrency(Number(entry.balance), currency)}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No one is owed right now.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] p-3">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">Top debtors</p>
                  <div className="mt-2.5 space-y-2">
                    {topDebtors.length > 0 ? topDebtors.map((entry) => (
                      <div key={`debtor-${entry.id}`} className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-foreground">{entry.name}</span>
                        <span className="font-medium text-amber-700 dark:text-amber-200">{formatCurrency(Math.abs(Number(entry.balance)), currency)}</span>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No one owes anything right now.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-4">
              <SecondarySection title="Recent activity">
                {activityItems.length > 0 ? (
                  <EventActivityFeed items={activityItems} maxItems={3} title={null} />
                ) : (
                  <p className="text-sm text-muted-foreground">No recent activity yet.</p>
                )}
              </SecondarySection>

              <SecondarySection title="Crew preview">
                {crewPreview.length > 0 ? (
                  <div className="space-y-2">
                    {crewPreview.map((participant: { id: number; name: string }) => (
                      <div key={`overview-crew-${participant.id}`} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] px-3 py-2">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                          {(participant.name || "?").slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
                          <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            Crew member
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No crew added yet.</p>
                )}
              </SecondarySection>
            </div>
          </>
        ) : null}
      </div>
    </PanelShell>
  );
}

export default OverviewPanel;
