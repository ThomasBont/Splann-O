import type { MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import OverviewPanel from "@/components/panels/OverviewPanel";
import ExpenseDetailPanel from "@/components/panels/ExpenseDetailPanel";
import ExpensesPanel from "@/components/panels/ExpensesPanel";
import CrewPanel from "@/components/panels/CrewPanel";
import PlanDetailsPanel from "@/components/panels/PlanDetailsPanel";
import NextActionPanel from "@/components/panels/NextActionsPanel";
import MemberProfilePanel from "@/components/panels/MemberProfilePanel";

export function ContextPanelHost({
  className,
  shellClassName,
  onMouseDown,
}: {
  className?: string;
  shellClassName?: string;
  onMouseDown?: MouseEventHandler<HTMLElement>;
} = {}) {
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
    case "member-profile":
      content = <MemberProfilePanel username={panel.username} />;
      break;
    case "next-action":
      content = <NextActionPanel />;
      break;
    case "plan-details":
      content = <PlanDetailsPanel />;
      break;
    default:
      return null;
  }

  return (
    <aside className={cn("relative z-10 hidden h-full w-[520px] flex-shrink-0 overflow-visible lg:block", className)} onMouseDown={onMouseDown}>
      <div className={cn("h-full rounded-[24px] border border-black/5 bg-[hsl(var(--surface-2))]/96 shadow-[0_4px_12px_rgba(15,23,42,0.05)] backdrop-blur-md dark:border-white/7 dark:bg-[hsl(var(--surface-2))]/96 dark:shadow-[0_4px_12px_rgba(0,0,0,0.18)]", shellClassName)}>
        {content}
      </div>
    </aside>
  );
}

export default ContextPanelHost;
