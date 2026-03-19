import type { MouseEventHandler } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { useActiveEventId } from "@/components/panels/panel-primitives";
import OverviewPanel from "@/components/panels/OverviewPanel";
import ExpenseDetailPanel from "@/components/panels/ExpenseDetailPanel";
import ExpensesPanel from "@/components/panels/ExpensesPanel";
import PhotosPanel from "@/components/panels/PhotosPanel";
import NotesPanel from "@/components/panels/NotesPanel";
import AddExpensePanel from "@/components/panels/AddExpensePanel";
import PollsPanel from "@/components/panels/PollsPanel";
import AddPollPanel from "@/components/panels/AddPollPanel";
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
  const activeEventId = useActiveEventId();
  const reduceMotion = useReducedMotion();

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
    case "photos":
      content = <PhotosPanel />;
      break;
    case "notes":
      content = <NotesPanel />;
      break;
    case "add-expense":
      content = <AddExpensePanel source={panel.source} editExpenseId={panel.editExpenseId ?? null} initialResolutionMode={panel.initialResolutionMode} initialPrefill={panel.prefill ?? null} />;
      break;
    case "settlement":
      content = <ExpensesPanel />;
      break;
    case "polls":
      content = <PollsPanel />;
      break;
    case "add-poll":
      content = <AddPollPanel source={panel.source} />;
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

  const panelInstanceKey = [
    activeEventId ?? "no-event",
    panel.type,
    panel.type === "expense" ? panel.id : "",
    panel.type === "settlement" ? `${panel.settlementId ?? ""}:${panel.createMode ?? ""}` : "",
    panel.type === "member-profile" ? panel.username : "",
    panel.type === "invite" || panel.type === "add-expense" || panel.type === "add-poll" ? (panel.source ?? "") : "",
    panel.type === "add-expense" ? String(panel.editExpenseId ?? "") : "",
    panel.type === "add-expense" ? (panel.initialResolutionMode ?? "") : "",
    panel.type === "add-expense" ? JSON.stringify(panel.prefill ?? null) : "",
  ].join(":");

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
            ? "h-full bg-[hsl(var(--surface-0))]"
            : "h-full overflow-hidden rounded-[24px] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-md)]",
          shellClassName,
        )}
      >
        {mobile ? (
          <motion.div
            key={panelInstanceKey}
            className="h-full min-h-0"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.998 }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {content}
          </motion.div>
        ) : (
          <div key={panelInstanceKey} className="h-full min-h-0">
            {content}
          </div>
        )}
      </div>
    </aside>
  );
}

export default ContextPanelHost;
