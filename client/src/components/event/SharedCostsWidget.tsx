import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SharedCostsDrawer from "@/components/event/SharedCostsDrawer";
import type { ExpenseWithParticipant } from "@shared/schema";
import type { Balance, Settlement } from "@/lib/split/calc";

type SharedCostsWidgetProps = {
  eventId: number | null;
  planName: string;
  peopleCount: number;
  totalSpentLabel: string;
  expenseCount: number;
  progressPercent: number;
  categories: string[];
  participants: Array<{ id: number; name: string }>;
  expenses: ExpenseWithParticipant[];
  balances: Balance[];
  settlements: Settlement[];
  formatMoney: (amount: number) => string;
  canAddExpense?: boolean;
};

export function SharedCostsWidget({
  eventId,
  planName,
  peopleCount,
  totalSpentLabel,
  expenseCount,
  progressPercent,
  categories,
  participants,
  expenses,
  balances,
  settlements,
  formatMoney,
  canAddExpense = true,
}: SharedCostsWidgetProps) {
  const [open, setOpen] = useState(false);
  const [initialView, setInitialView] = useState<"overview" | "expense-form">("overview");

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="w-full rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={() => {
          setInitialView("overview");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setInitialView("overview");
            setOpen(true);
          }
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Shared pot</p>
          {canAddExpense ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-full border-border/70 bg-background/70 px-2 text-[11px] text-muted-foreground hover:bg-muted"
              aria-label="Add expense for this plan"
              onClick={(event) => {
                event.stopPropagation();
                setInitialView("expense-form");
                setOpen(true);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{totalSpentLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {expenseCount} logged expense{expenseCount === 1 ? "" : "s"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/80 transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      </div>

      <SharedCostsDrawer
        eventId={eventId}
        open={open}
        onOpenChange={setOpen}
        initialView={initialView}
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
    </>
  );
}

export default SharedCostsWidget;
