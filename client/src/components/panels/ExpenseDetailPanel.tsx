import { useState } from "react";
import { Clock3, Loader2, Pencil, Receipt, Trash2, Users } from "lucide-react";
import { getExpenseLockState } from "@shared/lib/expense-lock";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAppToast } from "@/hooks/use-app-toast";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteExpense, useExpenses } from "@/hooks/use-expenses";
import { usePlan, usePlanCrew } from "@/hooks/use-plan-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelHeader, PanelSection, PanelShell, formatPanelDate, useActiveEventId } from "@/components/panels/panel-primitives";
import { formatShortEnglishDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";

function parseIncludedUserIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed.slice(1, -1).split(",").map((entry) => entry.replace(/^"+|"+$/g, "").trim()).filter(Boolean);
    }
  }
  return [];
}

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

function formatExpenseOccurredOn(value: string | null | undefined) {
  if (!value) return "Date TBD";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    if (!Number.isNaN(date.getTime())) {
      return formatShortEnglishDate(date, { weekday: true }) ?? "Date TBD";
    }
  }
  return formatShortEnglishDate(value, { weekday: true }) ?? formatPanelDate(value);
}

export function ExpenseDetailPanel({ id }: { id: string }) {
  const isMobile = useIsMobile();
  const eventId = useActiveEventId();
  const { user } = useAuth();
  const { replacePanel } = usePanel();
  const { toastError, toastSuccess } = useAppToast();
  const expensesQuery = useExpenses(eventId);
  const deleteExpense = useDeleteExpense(eventId);
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const expenseId = Number(id);
  const expense = (expensesQuery.data ?? []).find((entry: { id: number }) => Number(entry.id) === expenseId) ?? null;
  const participants = crewQuery.data?.participants ?? [];
  const includedIds = parseIncludedUserIds((expense as { includedUserIds?: unknown } | null)?.includedUserIds);
  const splitParticipants = includedIds.length > 0
    ? participants.filter((participant: { id: number }) => includedIds.includes(String(participant.id)))
    : participants;
  const currency = typeof planQuery.data?.currency === "string" ? planQuery.data.currency : "EUR";
  const resolutionMode = String((expense as { resolutionMode?: string | null } | null)?.resolutionMode ?? "later").trim().toLowerCase();
  const isSettledNow = resolutionMode === "now" || Boolean((expense as { excludedFromFinalSettlement?: boolean | null } | null)?.excludedFromFinalSettlement);
  const lockState = getExpenseLockState({
    planStatus: planQuery.data?.status,
    settlementStarted: Boolean((planQuery.data as { settlementStarted?: boolean | null } | null)?.settlementStarted),
    linkedSettlementRoundId: (expense as { linkedSettlementRoundId?: string | null } | null)?.linkedSettlementRoundId ?? null,
    settledAt: (expense as { settledAt?: string | Date | null } | null)?.settledAt ?? null,
    excludedFromFinalSettlement: (expense as { excludedFromFinalSettlement?: boolean | null } | null)?.excludedFromFinalSettlement ?? false,
    resolutionMode: (expense as { resolutionMode?: string | null } | null)?.resolutionMode ?? null,
  });
  const canEditExpense = !!expense && !lockState.locked;
  const canDeleteExpense = !!expense && !lockState.locked && Number((expense as { createdByUserId?: number | null }).createdByUserId ?? 0) === Number(user?.id ?? 0);

  if (!eventId) {
    return (
      <PanelShell>
        <PanelHeader label="Expense" title="Expense detail" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect expenses.
          </div>
        </div>
      </PanelShell>
    );
  }

  if (!expense) {
    return (
      <PanelShell>
        <PanelHeader label="Expense" title="Expense detail" />
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            This expense could not be found.
          </div>
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell>
      <PanelHeader
        label="Expense"
        title={expense.item || "Expense"}
        actions={(
          <div className="flex items-center gap-2">
            {canEditExpense ? (
              <Button type="button" size="sm" variant="outline" onClick={() => replacePanel({ type: "add-expense", source: "expenses", editExpenseId: expense.id })}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {canDeleteExpense ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        )}
        meta={(
          <>
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              {formatCurrency(Number(expense.amount || 0), currency)}
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {(expense as { occurredOn?: string | null }).occurredOn
                ? formatExpenseOccurredOn((expense as { occurredOn?: string | null }).occurredOn)
                : formatPanelDate(expense.createdAt ?? null)}
            </span>
          </>
        )}
      />

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-3 px-3 pb-[4.5rem] pt-2.5")}>
        {isMobile ? (
          <section className="rounded-[22px] border border-border/60 bg-card/80 px-3.5 py-3.5 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Expense summary</p>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-[17px] font-semibold tracking-tight text-foreground">
                  {expense.item || "Expense"}
                </h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Paid by {expense.participantName || "Unknown"}
                </p>
              </div>
              <span className="shrink-0 text-[18px] font-semibold text-foreground">
                {formatCurrency(Number(expense.amount || 0), currency)}
              </span>
            </div>
          </section>
        ) : null}

        <PanelSection title="Payment" className={cn(isMobile && "rounded-[20px] p-3.5")}>
          <div className={cn("space-y-2 text-sm", isMobile && "space-y-1.5")}>
            {lockState.locked ? (
              <div className={cn("rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200", isMobile && "px-3 py-2.5")}>
                {lockState.shortLabel}
              </div>
            ) : null}
            <div className={cn("flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2", isMobile && "px-3 py-2.5")}>
              <span className="text-muted-foreground">Payer</span>
              <span className="font-medium text-foreground">{expense.participantName || "Unknown"}</span>
            </div>
            <div className={cn("flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2", isMobile && "px-3 py-2.5")}>
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-medium text-foreground">{isSettledNow ? "Settled now" : "Later settle"}</span>
            </div>
            {(expense as { occurredOn?: string | null }).occurredOn ? (
              <div className={cn("flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2", isMobile && "items-start px-3 py-2.5")}>
                <span className="text-muted-foreground">Expense date</span>
                <span className={cn("font-medium text-foreground", isMobile && "text-right")}>
                  {formatExpenseOccurredOn((expense as { occurredOn?: string | null }).occurredOn ?? null)}
                </span>
              </div>
            ) : null}
          </div>
        </PanelSection>

        {isSettledNow ? (
          <PanelSection title="Status" className={cn(isMobile && "rounded-[20px] p-3.5")}>
            <div className={cn("rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground", isMobile && "px-3 py-3 text-[13px] leading-5")}>
              This expense was settled right away and won’t be included in the final settle up.
            </div>
          </PanelSection>
        ) : null}

        <PanelSection title="Split" className={cn(isMobile && "rounded-[20px] p-3.5")}>
          <div className={cn("rounded-xl bg-muted/40 px-3 py-3", isMobile && "px-3 py-3")}>
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-4 w-4" />
              {splitParticipants.length > 0 ? `${splitParticipants.length} people included` : "Split with everyone"}
            </p>
            <div className={cn("mt-3 flex flex-wrap gap-2", isMobile && "mt-2.5 gap-2.5")}>
              {splitParticipants.length > 0 ? splitParticipants.map((participant: { id: number; name: string }) => (
                <span
                  key={`expense-participant-${participant.id}`}
                  className={cn(
                    "rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground",
                    isMobile && "min-h-[2rem] px-3 py-1.5 text-[12px] leading-none inline-flex items-center",
                  )}
                >
                  {participant.name}
                </span>
              )) : (
                <span className="text-sm text-muted-foreground">No split data is available for this expense yet.</span>
              )}
            </div>
          </div>
        </PanelSection>
      </div>
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteExpense.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteExpense.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                try {
                  await deleteExpense.mutateAsync(expenseId);
                  toastSuccess("Expense deleted");
                  setConfirmDeleteOpen(false);
                  replacePanel({ type: "expenses" });
                } catch (error) {
                  toastError(error instanceof Error ? error.message : "Couldn’t delete expense.");
                }
              }}
            >
              {deleteExpense.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelShell>
  );
}

export default ExpenseDetailPanel;
