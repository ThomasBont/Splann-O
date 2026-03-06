import { usePanel } from "@/state/panel";
import OverviewPanel from "@/components/panels/OverviewPanel";
import ExpenseDetailPanel from "@/components/panels/ExpenseDetailPanel";
import ExpensesPanel from "@/components/panels/ExpensesPanel";
import CrewPanel from "@/components/panels/CrewPanel";
import PlanDetailsPanel from "@/components/panels/PlanDetailsPanel";
import NextActionsPanel from "@/components/panels/NextActionsPanel";

export function ContextPanelHost() {
  const { panel } = usePanel();

  if (!panel) return null;

  let content;
  switch (panel.type) {
    case "overview":
      content = <OverviewPanel />;
      break;
    case "expense":
      content = <ExpenseDetailPanel id={panel.id} />;
      break;
    case "expenses":
      content = <ExpensesPanel />;
      break;
    case "crew":
      content = <CrewPanel />;
      break;
    case "next-actions":
      content = <NextActionsPanel />;
      break;
    case "plan-details":
      content = <PlanDetailsPanel />;
      break;
    default:
      return null;
  }

  return (
    <aside className="hidden h-full w-[520px] flex-shrink-0 overflow-hidden rounded-l-2xl border-l border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/95 shadow-[-8px_0_24px_rgba(0,0,0,0.12)] backdrop-blur-md dark:shadow-[-8px_0_24px_rgba(0,0,0,0.24)] lg:block">
      {content}
    </aside>
  );
}

export default ContextPanelHost;
