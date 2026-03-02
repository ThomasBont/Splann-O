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
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-muted text-xs font-medium text-foreground">
              {expenseCount}
            </span>
            {canAddExpense ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8 rounded-full border-border/70 bg-background/70 text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Add expense for this plan"
                onClick={(event) => {
                  event.stopPropagation();
                  setInitialView("expense-form");
                  setOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{totalSpentLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {expenseCount} logged expense{expenseCount === 1 ? "" : "s"}
        </p>
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
