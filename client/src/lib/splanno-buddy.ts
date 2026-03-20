export type SplannoBuddyPresenceState = "idle" | "nudge";
export type SplannoBuddyIntent = "guide" | "warn" | "resolve" | "celebrate";
export type SplannoBuddyActionIntent =
  | "overview"
  | "expenses"
  | "crew"
  | "invite"
  | "settlement"
  | "chat"
  | "add-expense"
  | "plan-details";

export type SplannoBuddyAction = {
  id: string;
  label: string;
  intent: SplannoBuddyActionIntent;
  variant?: "primary" | "secondary" | "ghost";
};

export type SplannoBuddyStat = {
  label: string;
  value: string;
};

export type SplannoBuddyModel = {
  presenceState: SplannoBuddyPresenceState;
  intent: SplannoBuddyIntent;
  priority: number;
  title: string;
  chipLabel?: string | null;
  summary: string;
  primaryAttention?: string | null;
  stats: SplannoBuddyStat[];
  actions: SplannoBuddyAction[];
  inlineTitle?: string | null;
  milestoneKey?: string | null;
};

export type SplannoBuddyPanelModel = SplannoBuddyModel & {
  attention: string[];
  milestones: string[];
};

export type SplannoBuddyInput = {
  expenseCount: number;
  participantCount: number;
  pendingCount: number;
  planStatus?: string | null;
  canSettle?: boolean;
  hasActiveSettlement?: boolean;
  unpaidTransfers?: number;
  eventDate?: string | Date | null;
  isCreator?: boolean;
  settledAt?: string | Date | null;
  createdAt?: string | Date | null;
};

type SplannoBuddyCandidate = SplannoBuddyPanelModel;

function toDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(status?: string | null) {
  if (status === "archived") return "archived";
  if (status === "settled") return "settled";
  if (status === "closed") return "closed";
  return "active";
}

function buildMilestones({
  participantCount,
  pendingCount,
  createdAt,
  settledAt,
}: {
  participantCount: number;
  pendingCount: number;
  createdAt?: string | Date | null;
  settledAt?: string | Date | null;
}) {
  const milestones: string[] = [];
  if (createdAt) milestones.push("The plan is live and available for the group.");
  if (participantCount > 1 && pendingCount === 0) milestones.push("Everyone invited so far has joined.");
  if (settledAt) milestones.push("Settlement has already been completed.");
  return milestones;
}

function baseCandidate(input: {
  priority: number;
  intent: SplannoBuddyIntent;
  title: string;
  summary: string;
  primaryAttention?: string | null;
  chipLabel?: string | null;
  stats: SplannoBuddyStat[];
  actions: SplannoBuddyAction[];
  presenceState?: SplannoBuddyPresenceState;
  milestoneKey?: string | null;
  attention?: string[];
  milestones?: string[];
}): SplannoBuddyCandidate {
  return {
    presenceState: input.presenceState ?? (input.intent === "guide" ? "idle" : "nudge"),
    intent: input.intent,
    priority: input.priority,
    title: input.title,
    chipLabel: input.chipLabel ?? null,
    summary: input.summary,
    primaryAttention: input.primaryAttention ?? null,
    stats: input.stats,
    actions: input.actions,
    inlineTitle: "Splann-O",
    milestoneKey: input.milestoneKey ?? null,
    attention: input.attention ?? (input.primaryAttention ? [input.primaryAttention] : []),
    milestones: input.milestones ?? [],
  };
}

function deriveBaseSplannoBuddy(input: SplannoBuddyInput): SplannoBuddyPanelModel {
  const expenseCount = Math.max(0, Math.trunc(input.expenseCount || 0));
  const participantCount = Math.max(0, Math.trunc(input.participantCount || 0));
  const pendingCount = Math.max(0, Math.trunc(input.pendingCount || 0));
  const unpaidTransfers = Math.max(0, Math.trunc(input.unpaidTransfers || 0));
  const status = normalizeStatus(input.planStatus);
  const eventDate = toDate(input.eventDate);
  const now = Date.now();
  const startsSoon = !!eventDate && eventDate.getTime() > now && eventDate.getTime() - now <= 48 * 60 * 60 * 1000;
  const milestones = buildMilestones({
    participantCount,
    pendingCount,
    createdAt: input.createdAt,
    settledAt: input.settledAt,
  });

  const candidates: SplannoBuddyCandidate[] = [];

  if (status === "closed" && (input.hasActiveSettlement || input.canSettle)) {
    candidates.push(baseCandidate({
      priority: 100,
      intent: "resolve",
      chipLabel: "Blocked",
      title: "Planning is locked",
      summary: "Planning is locked now, so the remaining step is to close out the balances cleanly.",
      primaryAttention: input.hasActiveSettlement
        ? unpaidTransfers > 0
          ? `${unpaidTransfers} ${unpaidTransfers === 1 ? "payment is" : "payments are"} still unresolved.`
          : "Settlement is still open and needs to be reviewed."
        : "Balances still need to be turned into a final settlement.",
      stats: [
        { label: "Expenses", value: String(expenseCount) },
        { label: input.hasActiveSettlement ? "Open transfers" : "Ready to settle", value: input.hasActiveSettlement ? String(Math.max(1, unpaidTransfers)) : "Yes" },
      ],
      actions: [
        {
          id: "buddy-locked-settlement",
          label: input.hasActiveSettlement ? "Finish settlement" : (input.isCreator ? "Start settlement" : "Review settlement"),
          intent: "settlement",
          variant: "primary",
        },
        { id: "buddy-locked-expenses", label: "Review expenses", intent: "expenses", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (input.hasActiveSettlement) {
    candidates.push(baseCandidate({
      priority: unpaidTransfers > 0 ? 95 : 90,
      intent: "resolve",
      chipLabel: unpaidTransfers > 0 ? (unpaidTransfers === 1 ? "1 unresolved" : `${unpaidTransfers} unresolved`) : "Settlement live",
      title: "Settlement in progress",
      summary: unpaidTransfers > 0
        ? `There ${unpaidTransfers === 1 ? "is still 1 payment" : `are still ${unpaidTransfers} payments`} to confirm before the plan is fully resolved.`
        : "Settlement is in progress. A quick review of the current transfers should keep things moving.",
      primaryAttention: unpaidTransfers > 0
        ? `${unpaidTransfers} ${unpaidTransfers === 1 ? "transfer is" : "transfers are"} still outstanding.`
        : "Settlement is active and worth checking before the plan wraps up.",
      stats: [
        { label: "Open transfers", value: unpaidTransfers > 0 ? String(unpaidTransfers) : "Live" },
        { label: "Expenses", value: String(expenseCount) },
      ],
      actions: [
        { id: "buddy-settlement", label: unpaidTransfers > 0 ? "Finish settlement" : "Review settlement", intent: "settlement", variant: "primary" },
        { id: "buddy-expenses", label: "Review expenses", intent: "expenses", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (status !== "settled" && status !== "archived" && !input.hasActiveSettlement && participantCount > 1 && expenseCount > 0 && input.canSettle) {
    candidates.push(baseCandidate({
      priority: 80,
      intent: "resolve",
      chipLabel: "Ready to settle",
      title: "Balances are ready",
      summary: "The shared costs are clear enough now to start a settlement round when you are ready.",
      primaryAttention: "The current balances look ready to turn into payments.",
      stats: [
        { label: "Expenses", value: String(expenseCount) },
        { label: "People", value: String(participantCount) },
      ],
      actions: [
        {
          id: "buddy-settle-ready",
          label: input.isCreator ? "Start settlement" : "Review settlement",
          intent: "settlement",
          variant: "primary",
        },
        { id: "buddy-settle-expenses", label: "Review expenses", intent: "expenses", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (pendingCount > 0) {
    candidates.push(baseCandidate({
      priority: 70,
      intent: "warn",
      chipLabel: pendingCount === 1 ? "1 pending" : `${pendingCount} pending`,
      title: "Waiting for people to join",
      summary: pendingCount === 1
        ? "One person has not joined yet, so the plan is not fully in sync."
        : `Waiting for ${pendingCount} people to join so the plan can coordinate more smoothly.`,
      primaryAttention: startsSoon
        ? "The plan starts soon, so this is the main thing worth checking."
        : "Pending joins are the main thing to keep an eye on right now.",
      stats: [
        { label: "Joined", value: String(participantCount) },
        { label: "Pending", value: String(pendingCount) },
      ],
      actions: [
        { id: "buddy-pending", label: "Check pending people", intent: "crew", variant: "primary" },
        { id: "buddy-remind", label: "Invite friends", intent: "invite", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (participantCount > 1 && expenseCount === 0) {
    candidates.push(baseCandidate({
      priority: 60,
      intent: "guide",
      chipLabel: "Next step",
      title: "Shared planning is underway",
      summary: "The group is in place, but shared cost tracking has not started yet.",
      primaryAttention: "When the first group purchase happens, logging it here will keep everyone aligned.",
      stats: [
        { label: "People", value: String(participantCount) },
        { label: "Expenses", value: "0" },
      ],
      actions: [
        { id: "buddy-first-expense", label: "Add first expense", intent: "add-expense", variant: "primary" },
        { id: "buddy-open-expenses", label: "Review expenses", intent: "expenses", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (participantCount <= 1) {
    candidates.push(baseCandidate({
      priority: 55,
      intent: "guide",
      chipLabel: "Next step",
      title: "The plan still needs people",
      summary: "This plan is still mostly solo, so the next useful move is inviting a few more people in.",
      primaryAttention: "Once more people join, Splann-O can help coordinate the details more effectively.",
      stats: [
        { label: "People", value: String(participantCount) },
        { label: "Expenses", value: String(expenseCount) },
      ],
      actions: [
        { id: "buddy-invite-first", label: input.isCreator ? "Invite friends" : "Check crew", intent: input.isCreator ? "invite" : "crew", variant: "primary" },
        { id: "buddy-plan-details", label: "Check plan details", intent: "plan-details", variant: "secondary" },
      ],
      milestones,
    }));
  }

  if (status === "settled" || status === "archived") {
    candidates.push(baseCandidate({
      priority: 40,
      intent: "celebrate",
      presenceState: "nudge",
      chipLabel: "Completed",
      title: "The plan is wrapped up",
      summary: "Everything is settled. This is now mostly a final record of what happened.",
      primaryAttention: status === "archived"
        ? "The plan is archived, so the history is now read-only."
        : "Settlement has been finalized and no more action is needed.",
      stats: [
        { label: "Expenses", value: String(expenseCount) },
        { label: "People", value: String(participantCount) },
      ],
      actions: [
        { id: "buddy-review-final", label: "Review final details", intent: "overview", variant: "primary" },
        { id: "buddy-review-expenses", label: "Review expenses", intent: "expenses", variant: "secondary" },
      ],
      milestones,
      milestoneKey: input.settledAt ? `settlement-completed-${String(input.settledAt)}` : null,
    }));
  }

  if (participantCount > 1 && expenseCount > 0) {
    candidates.push(baseCandidate({
      priority: 30,
      intent: pendingCount === 0 ? "celebrate" : "guide",
      presenceState: pendingCount === 0 ? "nudge" : "idle",
      chipLabel: pendingCount === 0 ? "On track" : null,
      title: "The plan is moving",
      summary: startsSoon
        ? "The plan starts soon. A quick pass over the details should help everything feel ready."
        : "The plan has enough activity now to keep coordination moving smoothly.",
      primaryAttention: startsSoon
        ? "A quick review now will help avoid last-minute surprises."
        : "No urgent blocker stands out right now.",
      stats: [
        { label: "Expenses", value: String(expenseCount) },
        { label: "People", value: String(participantCount) },
      ],
      actions: [
        { id: "buddy-review-expenses-active", label: "Review expenses", intent: "expenses", variant: "primary" },
        { id: "buddy-check-details", label: "Check plan details", intent: "plan-details", variant: "secondary" },
      ],
      milestones,
      milestoneKey: pendingCount === 0 && participantCount > 1 ? `everyone-joined-${participantCount}` : null,
    }));
  }

  candidates.push(baseCandidate({
    priority: 10,
    intent: "guide",
    presenceState: "idle",
    chipLabel: null,
    title: "The plan is steady",
    summary: expenseCount > 0
      ? "Nothing urgent stands out right now. Review the plan whenever you want another pass."
      : "The plan is quiet for now, and Splann-O will surface the next meaningful change.",
    primaryAttention: expenseCount > 0 ? "There is no clear blocker at the moment." : "No shared costs are being tracked yet.",
    stats: [
      { label: "People", value: String(participantCount) },
      { label: "Expenses", value: String(expenseCount) },
    ],
    actions: expenseCount > 0
      ? [
          { id: "buddy-open-expense-list", label: "Review expenses", intent: "expenses", variant: "primary" },
          { id: "buddy-open-details", label: "Check plan details", intent: "plan-details", variant: "secondary" },
        ]
      : [
          { id: "buddy-add-expense-idle", label: "Add first expense", intent: "add-expense", variant: "primary" },
          { id: "buddy-open-crew", label: "Check crew", intent: "crew", variant: "secondary" },
        ],
    milestones,
    milestoneKey: input.createdAt ? `plan-created-${String(input.createdAt)}` : null,
  }));

  candidates.sort((left, right) => right.priority - left.priority);
  return candidates[0];
}

export function deriveSplannoBuddyModel(input: SplannoBuddyInput): SplannoBuddyModel {
  const model = deriveBaseSplannoBuddy(input);
  return {
    presenceState: model.presenceState,
    intent: model.intent,
    priority: model.priority,
    title: model.title,
    chipLabel: model.chipLabel,
    summary: model.summary,
    primaryAttention: model.primaryAttention,
    stats: model.stats,
    actions: model.actions,
    inlineTitle: model.inlineTitle,
    milestoneKey: model.milestoneKey,
  };
}

export function deriveSplannoBuddyPanelModel(input: SplannoBuddyInput): SplannoBuddyPanelModel {
  return deriveBaseSplannoBuddy(input);
}
