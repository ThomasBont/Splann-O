import { useMemo } from "react";
import { Plus, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getCategoryDef } from "@/config/expenseCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { resolveAssetUrl } from "@/lib/asset-url";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelHeader, PanelSection, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";

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

function initials(value?: string | null) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

export function ExpensesPanel() {
  const isMobile = useIsMobile();
  const eventId = useActiveEventId();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];
  const sharedExpenses = useMemo(
    () => expenses.filter((expense) => {
      const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
      const excluded = Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
      return !excluded && resolutionMode !== "now";
    }),
    [expenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = sharedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()),
    [expenses],
  );
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [Number(member.userId), member])),
    [members],
  );
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
        title="Shared expenses"
        actions={(
          <Button
            type="button"
            size="sm"
            className={cn(
              panelHeaderAddButtonClass(),
              isMobile && "hidden",
            )}
            onClick={handleAddExpense}
            disabled={!eventId}
            title="Add expense"
          >
            Add Expense +
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
                : `${formatCurrency(totalShared, currency)} shared · ${participants.length} people · ${sharedExpenses.length} expense${sharedExpenses.length === 1 ? "" : "s"}`}
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
            {sharedExpenses.length === 0 ? (
              <div className={cn(
                "rounded-xl border border-dashed border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/60 px-4 py-6 text-center",
                isMobile && "py-5",
              )}>
                <p className="text-sm font-medium text-foreground">No shared costs yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add the first expense when someone pays for the group.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={handleAddExpense}
                  disabled={!eventId}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add expense
                </Button>
              </div>
            ) : (
              <div className={cn("space-y-1", isMobile && "space-y-0.5")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(totalShared, currency)} shared
                    {" · "}
                    {sharedExpenses.length} expense{sharedExpenses.length === 1 ? "" : "s"}
                    {" · "}
                    {participants.length} people
                  </p>
                  <Button type="button" size="sm" onClick={handleAddExpense} disabled={!eventId}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add expense
                  </Button>
                </div>
              </div>
            )}

            {isMobile ? (
              <section className="sticky top-0 z-10 -mx-0.5 rounded-2xl border border-primary/20 bg-background/95 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/88">
                <Button
                  type="button"
                  className="h-10.5 w-full rounded-[16px] bg-primary text-sm font-semibold text-slate-900 hover:bg-primary/90"
                  onClick={handleAddExpense}
                  disabled={!eventId}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </section>
            ) : null}

            {sortedExpenses.length > 0 ? (
              <section className={cn("rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3.5 shadow-none", isMobile && "rounded-[18px] p-3")}>
                <div className={cn("space-y-1", isMobile && "space-y-0.5")}>
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    All expenses
                  </h3>
                  {sortedExpenses.map((expense) => (
                  (() => {
                    const categoryLabel = String(expense.category || "Other").trim() || "Other";
                    const CategoryIcon = getCategoryDef(categoryLabel).icon;
                    const payerName = String(expense.participantName || "Unknown").trim() || "Unknown";
                    const member = expense.participantUserId ? memberByUserId.get(Number(expense.participantUserId)) : undefined;
                    const avatarUrl = resolveAssetUrl(member?.avatarUrl ?? null) ?? member?.avatarUrl ?? "";
                    const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
                    const isSettledNow = resolutionMode === "now" || Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
                    return (
                      <button
                        type="button"
                        key={`expenses-panel-${expense.id}`}
                        onClick={() => openExpenseDetail(expense.id)}
                        className={cn(
                          "group w-full cursor-pointer rounded-xl border-b border-[hsl(var(--border-subtle))] bg-transparent px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          isMobile && "px-2.5 py-3",
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                              <CategoryIcon className="h-4 w-4" />
                            </span>
                            <p className="truncate text-[15px] font-medium text-foreground">
                              {expense.item || "Expense"}
                            </p>
                            {isSettledNow ? (
                              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                Settled now
                              </span>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-lg font-semibold text-foreground">
                            {formatCurrency(Number(expense.amount || 0), currency)}
                          </span>
                        </div>
                        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar className="h-5 w-5 shrink-0">
                            {avatarUrl ? <AvatarImage src={avatarUrl} alt={payerName} /> : null}
                            <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
                              {initials(payerName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{payerName}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{categoryLabel}</span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">{formatCreated(expense.createdAt ? String(expense.createdAt) : null)}</span>
                        </div>
                      </button>
                    );
                  })()
                  ))}
                </div>
                {sharedExpenses.length > 0 ? (
                  <div className="mt-2 px-1">
                    <button
                      type="button"
                      className="text-xs font-medium text-muted-foreground transition hover:text-foreground"
                      onClick={() => replacePanel({ type: "settlement", createMode: "balance-settlement" })}
                    >
                      Settle up
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default ExpensesPanel;
