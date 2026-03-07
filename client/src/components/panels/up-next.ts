export type UpNextAction = "settlement" | "crew" | "expenses" | "plan-details" | null;

export type UpNextItem = {
  type: "settlement" | "invite" | "expense" | "event" | "poll" | "done";
  title: string;
  description?: string;
  ctaLabel?: string | null;
  action?: UpNextAction;
};

export type UpNextContext = {
  expensesCount: number;
  pendingInvitesCount: number;
  canSettle: boolean;
  latestSettlementStatus: "proposed" | "in_progress" | "settled" | null;
  unpaidTransfers: number;
  eventDate: Date | string | null | undefined;
  isCreator: boolean;
};

type UpNextRule = (context: UpNextContext) => UpNextItem | null;

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUpcomingLabel(date: Date) {
  const now = new Date();
  const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) return "This plan starts tomorrow 🎉";
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
  return `${weekday} is coming up`;
}

const settlementRule: UpNextRule = (context) => {
  if (context.latestSettlementStatus && context.latestSettlementStatus !== "settled") {
    return {
      type: "settlement",
      title: context.unpaidTransfers > 0
        ? context.unpaidTransfers === 1
          ? "1 payment is still outstanding"
          : `${context.unpaidTransfers} payments still outstanding`
        : "Settlement is in progress",
      description: context.unpaidTransfers > 0
        ? "Open the settlement workflow to review transfers and mark payments as paid."
        : "Open settlement to confirm transfer status and finish the workflow.",
      ctaLabel: "View settlement",
      action: "settlement",
    };
  }

  if (!context.latestSettlementStatus && context.canSettle) {
    return {
      type: "settlement",
      title: "Balances are ready to settle",
      description: context.isCreator
        ? "Start the settlement plan so everyone can see who still needs to pay."
        : "Open settlement to see who still needs to pay whom.",
      ctaLabel: context.isCreator ? "Start settlement" : "Open settlement",
      action: "settlement",
    };
  }

  return null;
};

const pendingInvitesRule: UpNextRule = (context) => {
  if (context.pendingInvitesCount <= 0) return null;
  return {
    type: "invite",
    title: context.pendingInvitesCount === 1
      ? "1 friend still needs to join"
      : `${context.pendingInvitesCount} friends still need to join`,
    description: "Check the crew panel to see who is still pending and keep the plan moving.",
    ctaLabel: "View invites",
    action: "crew",
  };
};

const noExpensesRule: UpNextRule = (context) => {
  if (context.expensesCount > 0) return null;
  return {
    type: "expense",
    title: "Add the first expense",
    description: "Start tracking shared costs so the group can see what has been spent.",
    ctaLabel: "Add expense",
    action: "expenses",
  };
};

const upcomingEventRule: UpNextRule = (context) => {
  const date = toDate(context.eventDate);
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0 || diffMs > 48 * 60 * 60 * 1000) return null;
  return {
    type: "event",
    title: formatUpcomingLabel(date),
    description: "Review the plan details and make sure everything is still set before it starts.",
    ctaLabel: "View details",
    action: "plan-details",
  };
};

const pollsPlaceholderRule: UpNextRule = () => null;

const allDoneRule: UpNextRule = () => ({
  type: "done",
  title: "All done! Great trip 🎉",
  description: "Nothing needs attention right now.",
  ctaLabel: null,
  action: null,
});

const RULES: UpNextRule[] = [
  settlementRule,
  pendingInvitesRule,
  noExpensesRule,
  upcomingEventRule,
  pollsPlaceholderRule,
  allDoneRule,
];

export function getUpNext(context: UpNextContext): UpNextItem {
  for (const rule of RULES) {
    const result = rule(context);
    if (result) return result;
  }
  return allDoneRule(context)!;
}
