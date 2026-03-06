import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Plus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

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

function formatCreated(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

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

export function ExpensesPanel() {
  const eventId = useActiveEventId();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const { balances, settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const significantBalances = balances
    .filter((entry) => Math.abs(Number(entry.balance) || 0) >= 0.01)
    .sort((a, b) => Math.abs(Number(b.balance) || 0) - Math.abs(Number(a.balance) || 0));
  const recentExpenses = [...expenses]
    .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())
    .slice(0, 3);
  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: ["/api/events", eventId, "settlement", "latest"],
    queryFn: async () => {
      if (!eventId) return { settlement: null, transfers: [] };
      const res = await fetch(`/api/events/${eventId}/settlement/latest`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json() as Promise<SettlementResponse>;
    },
    enabled: !!eventId,
  });
  const latestSettlement = latestSettlementQuery.data?.settlement ?? null;
  const settlementTransfers = latestSettlementQuery.data?.transfers ?? [];
  const hasSettlementPlan = !!latestSettlement;
  const settlementButtonLabel = hasSettlementPlan ? "View settlement plan" : settlements.length > 0 ? "Start settlement plan" : null;
  const pendingTransfers = settlementTransfers.filter((transfer) => !transfer.paidAt);
  const settlementWorkflowTitle = hasSettlementPlan
    ? latestSettlement?.status === "settled"
      ? "Settlement complete"
      : pendingTransfers.length > 0
        ? `${pendingTransfers.length} payment${pendingTransfers.length === 1 ? "" : "s"} still pending`
        : "Settlement in progress"
    : settlements.length > 0
      ? "Ready to settle"
      : "No settlement needed";
  const settlementWorkflowBody = hasSettlementPlan
    ? latestSettlement?.status === "settled"
      ? "All transfers are marked paid. Open the settlement to review the final record."
      : "Keep this moving by checking the transfers below and marking payments as they happen."
    : settlements.length > 0
      ? "Turn the current balances into a settlement plan so everyone knows what to pay next."
      : "Keep adding shared expenses here. Settlement will appear once there is something to resolve.";

  const handleAddExpense = () => {
    if (!eventId) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expenses", {
      detail: { eventId, initialView: "expense-form" },
    }));
  };
  const handleSettlementAction = () => {
    if (!eventId) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expenses", {
      detail: { eventId, initialView: "overview" },
    }));
  };
  const handleViewAllExpenses = () => {
    if (!eventId) return;
    window.dispatchEvent(new CustomEvent("splanno:open-expenses", {
      detail: { eventId, initialView: "overview" },
    }));
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Expenses"
        title="Shared money"
        meta={(
          <>
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="font-medium text-foreground">{plan?.name ?? "Current plan"}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              {formatCurrency(totalShared, currency)} shared · {participants.length} people · {expenses.length} expense{expenses.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect shared money.
          </div>
        ) : (
          <>
            <PanelSection title="Balances" variant="ledger">
              {settlements.length > 0 ? (
                <div className="space-y-2">
                  {settlements.slice(0, 4).map((settlement, index) => (
                    <div key={`shared-money-settlement-${index}-${settlement.from}-${settlement.to}`} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] px-3 py-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium text-foreground">
                          {settlement.from} owes {settlement.to}
                        </p>
                        <p className="text-xs text-muted-foreground">Suggested settlement</p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(settlement.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              ) : significantBalances.length > 0 ? (
                <div className="space-y-2">
                  {significantBalances.slice(0, 4).map((entry) => {
                    const amount = Math.abs(Number(entry.balance) || 0);
                    const positive = Number(entry.balance) > 0;
                    return (
                      <div key={`shared-money-balance-${entry.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">{positive ? "Should receive" : "Owes"}</p>
                        </div>
                        <span className={cn(
                          "shrink-0 text-sm font-semibold",
                          positive ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-200",
                        )}>{formatCurrency(amount, currency)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Everyone is settled so far.</p>
              )}
            </PanelSection>

            <PanelSection title="Settlement workflow" variant="workflow">
              <div className="space-y-3">
                <div>
                  <h4 className="text-base font-semibold tracking-tight text-foreground">{settlementWorkflowTitle}</h4>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{settlementWorkflowBody}</p>
                </div>
                {hasSettlementPlan && settlementTransfers.length > 0 ? (
                  <div className="space-y-2">
                    {settlementTransfers.slice(0, 3).map((transfer) => (
                      <div key={`expenses-transfer-${transfer.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {transfer.fromName || "Someone"} pays {transfer.toName || "someone"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {transfer.paidAt ? "Marked paid" : "Waiting for payment"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {transfer.paidAt ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" /> : null}
                          <span className="shrink-0 text-sm font-semibold text-foreground">{formatCurrency(transfer.amount, currency)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  {settlementButtonLabel ? (
                    <Button type="button" onClick={handleSettlementAction}>
                      {settlementButtonLabel}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={handleAddExpense}>
                    <Plus className="h-4 w-4" />
                    Add expense
                  </Button>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Recent expenses" variant="ledger">
              {recentExpenses.length > 0 ? (
                <div className="space-y-2">
                  {recentExpenses.map((expense) => (
                    <div key={`expenses-panel-${expense.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{expense.item || "Expense"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {expense.participantName || "Unknown"} · {expense.category || "Other"} · {formatCreated(expense.createdAt ? String(expense.createdAt) : null)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatCurrency(Number(expense.amount || 0), currency)}
                      </span>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" className="px-0 text-sm text-muted-foreground hover:text-foreground" onClick={handleViewAllExpenses}>
                    View all expenses
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No expenses yet.</p>
              )}
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default ExpensesPanel;
