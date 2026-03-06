import { lazy, Suspense, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { circularActionButtonClass, cn } from "@/lib/utils";
import type { ExpenseWithParticipant } from "@shared/schema";
import type { Balance, Settlement } from "@/lib/split/calc";
const SharedCostsDrawer = lazy(() => import("@/components/event/SharedCostsDrawer"));

type SharedCostsWidgetProps = {
  eventId: number | null;
  currentUserId?: number | null;
  creatorUserId?: number | null;
  planName: string;
  peopleCount: number;
  totalSpentLabel: string;
  expenseCount: number;
  categories: string[];
  participants: Array<{ id: number; name: string; userId?: number | null }>;
  expenses: ExpenseWithParticipant[];
  balances: Balance[];
  settlements: Settlement[];
  formatMoney: (amount: number) => string;
  canAddExpense?: boolean;
  variant?: "default" | "glass";
  className?: string;
};

export function SharedCostsWidget({
  eventId,
  currentUserId = null,
  creatorUserId = null,
  planName,
  peopleCount,
  totalSpentLabel,
  expenseCount,
  categories,
  participants,
  expenses,
  balances,
  settlements,
  formatMoney,
  canAddExpense = true,
  variant = "default",
  className,
}: SharedCostsWidgetProps) {
  const [open, setOpen] = useState(false);
  const [initialView, setInitialView] = useState<"overview" | "expense-form">("overview");
  const [initialExpenseId, setInitialExpenseId] = useState<number | null>(null);
  const [initialExpensePrefill, setInitialExpensePrefill] = useState<{
    amount?: number | null;
    item?: string | null;
    paidBy?: string | null;
    splitCount?: number | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOpenExpense = (event: Event) => {
      const custom = event as CustomEvent<{ eventId?: number; expenseId?: number }>;
      const targetEventId = Number(custom.detail?.eventId);
      const targetExpenseId = Number(custom.detail?.expenseId);
      if (!Number.isFinite(targetEventId) || targetEventId !== eventId) return;
      if (!Number.isFinite(targetExpenseId)) return;
      setInitialExpenseId(targetExpenseId);
      setInitialExpensePrefill(null);
      setInitialView("expense-form");
      setOpen(true);
    };
    const onOpenExpenses = (event: Event) => {
      const custom = event as CustomEvent<{
        eventId?: number;
        initialView?: "overview" | "expense-form";
        prefill?: {
          amount?: number | null;
          item?: string | null;
          paidBy?: string | null;
          splitCount?: number | null;
        };
      }>;
      const targetEventId = Number(custom.detail?.eventId);
      if (!Number.isFinite(targetEventId) || targetEventId !== eventId) return;
      setInitialExpenseId(null);
      setInitialExpensePrefill(custom.detail?.prefill ?? null);
      setInitialView(custom.detail?.initialView === "expense-form" ? "expense-form" : "overview");
      setOpen(true);
    };
    window.addEventListener("splanno:open-expense", onOpenExpense as EventListener);
    window.addEventListener("splanno:open-expenses", onOpenExpenses as EventListener);
    return () => {
      window.removeEventListener("splanno:open-expense", onOpenExpense as EventListener);
      window.removeEventListener("splanno:open-expenses", onOpenExpenses as EventListener);
    };
  }, [eventId]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "w-full rounded-2xl p-4 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          variant === "glass"
            ? "border border-white/10 bg-white/5 shadow-sm backdrop-blur-md hover:border-white/20"
            : "border border-border/70 bg-card shadow-sm hover:-translate-y-0.5 hover:border-border",
          className,
        )}
        onClick={(event) => {
          event.stopPropagation();
          setInitialExpenseId(null);
          setInitialView("overview");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            setInitialView("overview");
            setOpen(true);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            "text-xs font-medium uppercase tracking-wide",
            variant === "glass" ? "text-white/60" : "text-muted-foreground",
          )}>Shared pot</p>
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-medium text-foreground">
              {expenseCount}
            </span>
            {canAddExpense ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className={`h-8 w-8 ${circularActionButtonClass()}`}
                aria-label="Add expense for this plan"
                onClick={(event) => {
                  event.stopPropagation();
                  setInitialExpenseId(null);
                  setInitialView("expense-form");
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <p className={cn("mt-3 text-2xl font-semibold tracking-tight", variant === "glass" ? "text-white/90" : "text-foreground")}>{totalSpentLabel}</p>
        <p className={cn("mt-1 text-xs", variant === "glass" ? "text-white/60" : "text-muted-foreground")}>
          {expenseCount} logged expense{expenseCount === 1 ? "" : "s"}
        </p>
      </div>

      {open ? (
        <Suspense fallback={null}>
          <SharedCostsDrawer
            eventId={eventId}
            currentUserId={currentUserId}
            creatorUserId={creatorUserId}
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) {
                setInitialExpenseId(null);
                setInitialExpensePrefill(null);
              }
            }}
            initialView={initialView}
            initialExpenseId={initialExpenseId}
            initialExpensePrefill={initialExpensePrefill}
            planName={planName}
            peopleCount={peopleCount}
            totalSpentLabel={totalSpentLabel}
            expenseCount={expenseCount}
            categories={categories}
            participants={participants}
            expenses={expenses}
            balances={balances}
            settlements={settlements}
            formatMoney={formatMoney}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export default SharedCostsWidget;
