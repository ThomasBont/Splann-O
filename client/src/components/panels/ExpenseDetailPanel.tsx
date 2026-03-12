import { Clock3, Receipt, Users } from "lucide-react";
import { useExpenses } from "@/hooks/use-expenses";
import { usePlan, usePlanCrew } from "@/hooks/use-plan-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelHeader, PanelSection, PanelShell, formatPanelDate, useActiveEventId } from "@/components/panels/panel-primitives";
import { formatShortEnglishDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

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
  const expensesQuery = useExpenses(eventId);
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
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
    </PanelShell>
  );
}

export default ExpenseDetailPanel;
