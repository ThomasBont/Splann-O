import { CalendarDays, Globe, Lock, MapPin, Sparkles } from "lucide-react";
import { derivePlanTypeSelection, getPlanMainTypeLabel, getPlanSubcategoryLabel } from "@shared/lib/plan-types";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, formatPanelDate, formatPanelLocation, useActiveEventId } from "@/components/panels/panel-primitives";

function getPlanTypeLabel(plan: { templateData?: unknown; eventType?: string | null } | null) {
  const selection = derivePlanTypeSelection({
    templateData: plan?.templateData,
    eventType: plan?.eventType ?? null,
  });
  if (!selection.mainType) return "General";
  const main = getPlanMainTypeLabel(selection.mainType);
  return selection.subcategory ? `${main} · ${getPlanSubcategoryLabel(selection.subcategory)}` : main;
}

export function PlanDetailsPanel() {
  const eventId = useActiveEventId();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const isPrivate = (plan?.visibilityOrigin ?? "private") === "private";
  const privacyLabel = isPrivate ? "Private plan" : "Public plan";

  return (
    <PanelShell>
      <PanelHeader
        label="Plan details"
        title={plan?.name ?? "Plan"}
        meta={(
          <>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {formatPanelDate(plan?.date)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{formatPanelLocation(plan)}</span>
            </span>
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!plan ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect its details.
          </div>
        ) : (
          <>
            <PanelSection title="Overview">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-foreground">{formatPanelLocation(plan)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium text-foreground">{formatPanelDate(plan.date)}</span>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Plan setup">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                    Plan type
                  </span>
                  <span className="font-medium text-foreground">{getPlanTypeLabel(plan)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    {isPrivate ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    Visibility
                  </span>
                  <span className="font-medium text-foreground">{privacyLabel}</span>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Snapshot">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Crew</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{participants.length}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{expenses.length}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">{String(plan.status ?? "active")}</p>
                </div>
              </div>
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default PlanDetailsPanel;
