import { useState } from "react";
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
  participants: Array<{ id: number; name: string }>;
  expenses: ExpenseWithParticipant[];
  balances: Balance[];
  settlements: Settlement[];
  formatMoney: (amount: number) => string;
};

export function SharedCostsWidget({
  eventId,
  planName,
  peopleCount,
  totalSpentLabel,
  expenseCount,
  progressPercent,
  participants,
  expenses,
  balances,
  settlements,
  formatMoney,
}: SharedCostsWidgetProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Shared pot</p>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-800">{totalSpentLabel}</p>
        <p className="mt-1 text-xs text-slate-500">
          {expenseCount} logged expense{expenseCount === 1 ? "" : "s"}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-amber-300 transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      </button>

      <SharedCostsDrawer
        eventId={eventId}
        open={open}
        onOpenChange={setOpen}
        planName={planName}
        peopleCount={peopleCount}
        totalSpentLabel={totalSpentLabel}
        expenseCount={expenseCount}
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
