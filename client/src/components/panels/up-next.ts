export type UpNextAction = "settlement" | "crew" | "invite" | "expenses" | "add-expense" | "plan-details" | null;

export type UpNextItem = {
  type: "settlement" | "invite" | "expense" | "event" | "poll" | "done";
  title: string;
  description?: string;
  ctaLabel?: string | null;
  action?: UpNextAction;
};

export type UpNextContext = {
  participantCount: number;
  expensesCount: number;
  pendingInvitesCount: number;
  canSettle: boolean;
  latestSettlementStatus: "active" | "completed" | "cancelled" | null;
  unpaidTransfers: number;
  eventDate: Date | string | null | undefined;
  isCreator: boolean;
};

type UpNextRule = (context: UpNextContext) => UpNextItem | null;

const ROTATING_UP_NEXT_INTERVAL_MS = 20_000;

export function getUpNextRotationIntervalMs() {
  return ROTATING_UP_NEXT_INTERVAL_MS;
}

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
  if (context.latestSettlementStatus === "active") {
    return {
      type: "settlement",
      title: context.unpaidTransfers > 0
        ? context.unpaidTransfers === 1
          ? "1 payment is still outstanding"
          : `${context.unpaidTransfers} payments still outstanding`
        : "Settle up is in progress",
      description: context.unpaidTransfers > 0
        ? "Open settle up to review transfers and mark payments as paid."
        : "Open settle up to confirm transfer status and finish the workflow.",
      ctaLabel: "Open settle up",
      action: "settlement",
    };
  }

  if (!context.latestSettlementStatus && context.canSettle) {
    return {
      type: "settlement",
      title: "Balances are ready to settle",
      description: context.isCreator
        ? "Start settle up so everyone can see who still needs to pay."
        : "Open settle up to see who still needs to pay whom.",
      ctaLabel: context.isCreator ? "Start settle up" : "Open settle up",
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
    description: "Send reminders or copy the invite link to keep the plan moving.",
    ctaLabel: "View invites",
    action: "invite",
  };
};

const firstInviteRule: UpNextRule = (context) => {
  if (context.participantCount > 1) return null;
  return {
    type: "invite",
    title: "Invite your first friend",
    description: "Bring someone into the plan first so decisions and costs can actually move.",
    ctaLabel: "Invite friends",
    action: "invite",
  };
};

const noExpensesRule: UpNextRule = (context) => {
  if (context.participantCount <= 1) return null;
  if (context.expensesCount > 0) return null;
  return {
    type: "expense",
    title: "Add the first expense",
    description: "Start tracking shared costs so the group can see what has been spent.",
    ctaLabel: "Add expense",
    action: "add-expense",
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
  title: "You're all good 🎉",
  description: "Nothing left to do — the plan is on track.",
  ctaLabel: null,
  action: null,
});

const RULES: UpNextRule[] = [
  settlementRule,
  firstInviteRule,
  pendingInvitesRule,
  noExpensesRule,
  upcomingEventRule,
  pollsPlaceholderRule,
];

export function getUpNextCandidates(context: UpNextContext): UpNextItem[] {
  const items = RULES
    .map((rule) => rule(context))
    .filter((item): item is UpNextItem => !!item);
  return items.length > 0 ? items : [allDoneRule(context)!];
}

export function getUpNext(context: UpNextContext, rotationIndex = 0): UpNextItem {
  const items = getUpNextCandidates(context);
  const safeIndex = Number.isFinite(rotationIndex) ? Math.max(0, Math.trunc(rotationIndex)) : 0;
  return items[safeIndex % items.length] ?? items[0];
}
