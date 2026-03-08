import { useMemo, useState } from "react";
import { ChevronDown, Plus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
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

export function ExpensesPanel() {
  const [recentExpanded, setRecentExpanded] = useState(false);
  const isMobile = useIsMobile();
  const eventId = useActiveEventId();
  const { replacePanel } = usePanel();
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
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()),
    [expenses],
  );
  const visibleRecentExpenses = recentExpanded ? sortedExpenses : sortedExpenses.slice(0, 3);
  const handleAddExpense = () => {
    if (!eventId) return;
    replacePanel({ type: "add-expense", source: "expenses" });
  };
  const openExpenseDetail = (expenseId: number) => {
    replacePanel({ type: "expense", id: String(expenseId) });
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Expenses"
        title="Shared money"
        actions={(
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-9 rounded-full bg-primary px-4 text-slate-900 hover:bg-primary/90",
              isMobile && "hidden",
            )}
            onClick={handleAddExpense}
            disabled={!eventId}
            title="Add expense"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add expense
          </Button>
        )}
        meta={(
          <>
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="font-medium text-foreground">{plan?.name ?? "Current plan"}</span>
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              {isMobile
                ? `${formatCurrency(totalShared, currency)} shared`
                : `${formatCurrency(totalShared, currency)} shared · ${participants.length} people · ${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
            </span>
          </>
        )}
      />

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-3 px-3.5 pb-20 pt-3")}>
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect shared money.
          </div>
        ) : (
          <>
            {isMobile ? (
              <section className="sticky top-0 z-10 -mx-0.5 rounded-2xl border border-primary/20 bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/88">
                <Button
                  type="button"
                  className="h-10.5 w-full rounded-[16px] bg-primary text-sm font-semibold text-slate-900 hover:bg-primary/90"
                  onClick={handleAddExpense}
                  disabled={!eventId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add expense
                </Button>
              </section>
            ) : null}

            <section className={cn("rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3.5 shadow-none", isMobile && "rounded-[18px] p-3")}>
              <button
                type="button"
                className={cn("flex w-full items-center justify-between gap-3 text-left", isMobile && "min-h-9")}
                onClick={() => setRecentExpanded((prev) => !prev)}
                aria-expanded={recentExpanded}
                aria-controls="recent-expenses-list"
              >
                <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent expenses</h3>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", recentExpanded && "rotate-180")} />
              </button>
              {visibleRecentExpenses.length > 0 ? (
                <div id="recent-expenses-list" className={cn("mt-3 space-y-2", isMobile && "mt-2.5 space-y-1.5")}>
                  {visibleRecentExpenses.map((expense) => (
                    <button
                      type="button"
                      key={`expenses-panel-${expense.id}`}
                      onClick={() => openExpenseDetail(expense.id)}
                      className={cn(
                        "interactive-card flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] text-left hover:border-border/80 hover:bg-[hsl(var(--surface-2))]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isMobile ? "px-3 py-2.5" : "px-3 py-2.5",
                      )}
                    >
                      <div className="min-w-0">
                        <p className={cn("truncate font-medium text-foreground", isMobile ? "text-sm" : "text-sm")}>
                          {expense.item || "Expense"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          Paid by {expense.participantName || "Unknown"}
                        </p>
                        {isMobile ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {expense.category || "Other"} · {formatCreated(expense.createdAt ? String(expense.createdAt) : null)}
                          </p>
                        ) : null}
                        {!isMobile ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {expense.category || "Other"} · {formatCreated(expense.createdAt ? String(expense.createdAt) : null)}
                          </p>
                        ) : null}
                      </div>
                      <span className={cn("shrink-0 font-semibold text-foreground", isMobile ? "text-sm" : "text-sm")}>
                        {formatCurrency(Number(expense.amount || 0), currency)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p id="recent-expenses-list" className="mt-3 text-sm text-muted-foreground">No expenses yet.</p>
              )}
            </section>

            <PanelSection title="Balances" variant="ledger">
              {settlements.length > 0 ? (
                <div className="space-y-2">
                  {settlements.slice(0, 4).map((settlement, index) => (
                    <div key={`shared-money-settlement-${index}-${settlement.from}-${settlement.to}`} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))] px-3 py-3">
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
                    return (
                      <div
                        key={`shared-money-balance-${entry.id}`}
                    className={cn("flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]", isMobile ? "px-3 py-2.5" : "px-3 py-2.5")}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{entry.name}</p>
                          <p className="text-xs text-muted-foreground">{Number(entry.balance) > 0 ? "Should receive" : "Owes"}</p>
                        </div>
                        <span className={Number(entry.balance) > 0 ? "shrink-0 text-sm font-semibold text-emerald-700 dark:text-emerald-300" : "shrink-0 text-sm font-semibold text-amber-700 dark:text-amber-200"}>
                          {formatCurrency(amount, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Everyone is settled so far.</p>
              )}
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default ExpensesPanel;
