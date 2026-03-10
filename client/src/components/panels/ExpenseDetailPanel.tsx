import { Clock3, Receipt, Tag, Users } from "lucide-react";
import { useExpenses } from "@/hooks/use-expenses";
import { usePlan, usePlanCrew } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, formatPanelDate, useActiveEventId } from "@/components/panels/panel-primitives";

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

export function ExpenseDetailPanel({ id }: { id: string }) {
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
              {formatPanelDate(expense.createdAt ?? null)}
            </span>
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <PanelSection title="Payment">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Payer</span>
              <span className="font-medium text-foreground">{expense.participantName || "Unknown"}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Category</span>
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Tag className="h-3.5 w-3.5" />
                {expense.category || "Other"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-medium text-foreground">{isSettledNow ? "Settled now" : "Later settle"}</span>
            </div>
          </div>
        </PanelSection>

        {isSettledNow ? (
          <PanelSection title="Status">
            <div className="rounded-xl bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
              This expense was settled right away and won’t be included in the final settle up.
            </div>
          </PanelSection>
        ) : null}

        <PanelSection title="Split">
          <div className="rounded-xl bg-muted/40 px-3 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="h-4 w-4" />
              {splitParticipants.length > 0 ? `${splitParticipants.length} people included` : "Split with everyone"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {splitParticipants.length > 0 ? splitParticipants.map((participant: { id: number; name: string }) => (
                <span key={`expense-participant-${participant.id}`} className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground">
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
