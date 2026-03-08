import type { MouseEventHandler } from "react";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import OverviewPanel from "@/components/panels/OverviewPanel";
import ExpenseDetailPanel from "@/components/panels/ExpenseDetailPanel";
import ExpensesPanel from "@/components/panels/ExpensesPanel";
import AddExpensePanel from "@/components/panels/AddExpensePanel";
import SettlementPanel from "@/components/panels/SettlementPanel";
import CrewPanel from "@/components/panels/CrewPanel";
import InviteFlowPanel from "@/components/panels/InviteFlowPanel";
import PlanDetailsPanel from "@/components/panels/PlanDetailsPanel";
import NextActionPanel from "@/components/panels/NextActionsPanel";
import MemberProfilePanel from "@/components/panels/MemberProfilePanel";
import RecentActivityPanel from "@/components/panels/RecentActivityPanel";

export function ContextPanelHost({
  className,
  shellClassName,
  onMouseDown,
  mobile = false,
}: {
  className?: string;
  shellClassName?: string;
  onMouseDown?: MouseEventHandler<HTMLElement>;
  mobile?: boolean;
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
    case "add-expense":
      content = <AddExpensePanel source={panel.source} />;
      break;
    case "settlement":
      content = <SettlementPanel />;
      break;
    case "crew":
      content = <CrewPanel />;
      break;
    case "invite":
      content = <InviteFlowPanel />;
      break;
    case "member-profile":
      content = <MemberProfilePanel username={panel.username} />;
      break;
    case "next-action":
      content = <NextActionPanel />;
      break;
    case "recent-activity":
      content = <RecentActivityPanel />;
      break;
    case "plan-details":
      content = <PlanDetailsPanel />;
      break;
    default:
      return null;
  }

  return (
    <aside
      className={cn(
        mobile
          ? "relative z-10 block h-full w-full min-w-0 overflow-hidden lg:hidden"
          : "relative z-10 hidden h-full w-[520px] flex-shrink-0 overflow-visible lg:block",
        className,
      )}
      onMouseDown={onMouseDown}
    >
      <div
        className={cn(
          mobile
            ? "h-full rounded-[24px] border border-black/5 bg-[hsl(var(--surface-1))] shadow-[0_4px_12px_rgba(15,23,42,0.05)] dark:border-white/7 dark:bg-[hsl(var(--surface-1))] dark:shadow-[0_4px_12px_rgba(0,0,0,0.18)]"
            : "h-full rounded-[24px] border border-black/5 bg-[hsl(var(--surface-2))]/96 shadow-[0_4px_12px_rgba(15,23,42,0.05)] backdrop-blur-md dark:border-white/7 dark:bg-[hsl(var(--surface-2))]/96 dark:shadow-[0_4px_12px_rgba(0,0,0,0.18)]",
          shellClassName,
        )}
      >
        {content}
      </div>
    </aside>
  );
}

export default ContextPanelHost;
