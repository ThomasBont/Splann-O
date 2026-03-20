import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { useNotes } from "@/hooks/use-notes";
import { useLatestRunningPoll } from "@/hooks/use-latest-running-poll";
import { apiRequest } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatFullDate } from "@/lib/dates";
import { computeSplit } from "@/lib/split/calc";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";
import { useEventGuests } from "@/hooks/use-event-guests";
import { getClientPlanStatus, getPlanFinalState, getPlanWrapUpEndsAt } from "@/lib/plan-lifecycle";
import { StatCard } from "@/components/panels/stat-card";

type SettlementRoundSummary = {
  id: string;
  title: string;
  roundType: "balance_settlement" | "direct_split";
  scopeType: "everyone" | "selected";
  selectedParticipantIds: number[] | null;
  status: "active" | "completed" | "cancelled";
  currency: string | null;
  paidByUserId?: number | null;
  paidByName?: string | null;
  createdAt: string | null;
  completedAt: string | null;
  transferCount: number;
  paidTransfersCount: number;
  totalAmount: number;
  outstandingAmount: number;
};

type SettlementRoundsResponse = {
  activeFinalSettlementRound: SettlementRoundSummary | null;
  activeQuickSettleRound: SettlementRoundSummary | null;
  pastFinalSettlementRounds: SettlementRoundSummary[];
  pastQuickSettleRounds: SettlementRoundSummary[];
};

type SettlementDetailResponse = {
  settlement: {
    id: string;
    title: string;
    roundType: "balance_settlement" | "direct_split";
    status: "active" | "completed" | "cancelled";
    currency: string | null;
    createdAt: string | null;
    completedAt: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
    settlementRoundId: string;
    fromUserId: number;
    fromName?: string;
    toUserId: number;
    toName?: string;
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
  }>;
  summary: {
    transferCount: number;
    paidTransfersCount: number;
    totalAmount: number;
    outstandingAmount: number;
  };
};

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
  return `€ ${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function avatarTint(index: number) {
  const palette = [
    "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
    "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100",
    "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
    "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-100",
  ];
  return palette[index % palette.length];
}

interface AvatarListParticipant {
  id: number;
  name: string;
  firstName?: string;
  avatarUrl?: string | null;
  username?: string | null;
  displayName?: string;
}

function AvatarList({ participants, onClickAvatar }: { participants: AvatarListParticipant[]; onClickAvatar?: (username?: string | null) => void }) {
  const isMobile = useIsMobile();
  const maxShown = isMobile ? 3 : 4;
  const shown = participants.slice(0, maxShown);
  const hidden = Math.max(0, participants.length - maxShown);

  return (
    <div className="flex items-center gap-2">
      {shown.map((person, index) => (
        <div key={`avatar-${person.id}`}>
          {person.username ? (
            <button
              type="button"
              onClick={() => onClickAvatar?.(person.username)}
              className="block cursor-pointer rounded-full transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[hsl(var(--surface-2))]"
              aria-label={`Open ${person.displayName || person.name}'s profile`}
            >
              <Avatar className={cn("h-8 w-8 border border-border/70", isMobile ? "h-7 w-7" : "")}>
                {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
                <AvatarFallback className={cn("text-xs font-semibold", avatarTint(index))}>
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Avatar className={cn("h-8 w-8 border border-border/70", isMobile ? "h-7 w-7" : "")}>
              {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
              <AvatarFallback className={cn("text-xs font-semibold", avatarTint(index))}>
                {getInitials(person.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <div className="ml-1 grid h-8 w-8 place-items-center rounded-full border border-dashed border-border/70 bg-background text-xs font-semibold text-muted-foreground dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/90">
          +{hidden}
        </div>
      )}
    </div>
  );
}

export function OverviewPanel() {
  const eventId = useActiveEventId();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { closePanel, replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const notesQuery = useNotes(eventId);
  const pollQuery = useLatestRunningPoll(eventId);
  const settlementRoundsQuery = useQuery<SettlementRoundsResponse>({
    queryKey: queryKeys.plans.settlements(eventId),
    queryFn: async () => {
      if (!eventId) {
        return {
          activeFinalSettlementRound: null,
          activeQuickSettleRound: null,
          pastFinalSettlementRounds: [],
          pastQuickSettleRounds: [],
        };
      }
      return apiRequest<SettlementRoundsResponse>(`/api/events/${eventId}/settlements`);
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];
  const guests = useEventGuests(eventId);
  const pendingInvites = guests.invitesPending;
  const laterSettleExpenses = useMemo(
    () => expenses.filter((expense) => {
      const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
      const excluded = Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
      return !excluded && resolutionMode !== "now";
    }),
    [expenses],
  );
  const splitExpenses = useMemo(
    () => laterSettleExpenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [laterSettleExpenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = useMemo(
    () => laterSettleExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    [laterSettleExpenses],
  );
  const { balances, settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const canSettle = settlements.length > 0;
  const activeFinalSettlementRound = settlementRoundsQuery.data?.activeFinalSettlementRound ?? null;
  const pastFinalSettlementRounds = settlementRoundsQuery.data?.pastFinalSettlementRounds ?? [];
  const latestPastFinalSettlementRound = pastFinalSettlementRounds[0] ?? null;
  const planStatus = getClientPlanStatus(plan?.status);
  const isPlanClosed = planStatus === "closed";
  const isPlanSettled = planStatus === "settled";
  const isPlanArchived = planStatus === "archived";
  const isFinanciallyCompleted = isPlanSettled || isPlanArchived;
  const invitesLocked = isPlanClosed || isFinanciallyCompleted || !!activeFinalSettlementRound;
  const expensesLocked = invitesLocked;
  const completedSettlementId = isFinanciallyCompleted ? latestPastFinalSettlementRound?.id ?? null : null;
  const completedSettlementDetailQuery = useQuery<SettlementDetailResponse>({
    queryKey: queryKeys.plans.settlementDetail(eventId, completedSettlementId),
    queryFn: async () => {
      if (!eventId || !completedSettlementId) {
        return {
          settlement: null,
          transfers: [],
          summary: { transferCount: 0, paidTransfersCount: 0, totalAmount: 0, outstandingAmount: 0 },
        };
      }
      return apiRequest<SettlementDetailResponse>(`/api/events/${eventId}/settlement/${encodeURIComponent(completedSettlementId)}`);
    },
    enabled: !!eventId && !!completedSettlementId,
    staleTime: 15_000,
    refetchInterval: eventId && completedSettlementId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });
  const unpaidTransfers = Math.max(
    0,
    (activeFinalSettlementRound?.transferCount ?? 0) - (activeFinalSettlementRound?.paidTransfersCount ?? 0),
  );
  const myParticipant = user?.id
    ? participants.find((participant: { userId?: number | null }) => participant.userId === user.id) ?? null
    : null;
  const allBalancesZero = balances.every((entry) => Math.abs(Number(entry.balance) || 0) < 0.01);
  const settlementCompleted = isFinanciallyCompleted || (!activeFinalSettlementRound && latestPastFinalSettlementRound?.status === "completed" && allBalancesZero);
  const completedTransfers = completedSettlementDetailQuery.data?.transfers ?? [];
  const finalPayment = completedTransfers[0] ?? null;
  const planCreatedAt = formatFullDate((plan as { createdAt?: string | Date | null } | null)?.createdAt ?? null);
  const finalPlanState = getPlanFinalState(plan?.status, (plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const planCompletedAt = formatFullDate(finalPlanState?.at ?? null);
  const wrapUpEndsAt = getPlanWrapUpEndsAt((plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const wrapUpEndsLabel = formatFullDate(wrapUpEndsAt);

  const contributionRows = useMemo(() => {
    return buildCrewContributionRows({ participants, members, expenses: laterSettleExpenses }).map((row, index) => ({
      ...row,
      tint: avatarTint(index),
      isMe: row.id === myParticipant?.id,
    }));
  }, [laterSettleExpenses, members, myParticipant?.id, participants]);

  // Data aggregation for dashboard stats
  const attendanceCount = participants.length;
  const pendingCount = Math.max(0, pendingInvites.length);
  const confirmedCount = attendanceCount - pendingCount;

  // Enrich participants with member data for avatar display
  const enrichedParticipants = useMemo(() => {
    const memberByUserId = new Map(members.map((m) => [m.userId, m]));
    const memberByName = new Map(members.map((m) => [m.name?.trim().toLowerCase(), m]));
    return participants.map((p) => {
      const member =
        (p.userId ? memberByUserId.get(p.userId) : null) ?? memberByName.get(p.name?.trim().toLowerCase() ?? "") ?? null;
      return {
        id: p.id,
        name: p.name,
        firstName: p.name.trim().split(/\s+/)[0] || p.name,
        avatarUrl: member?.avatarUrl,
        username: member?.username,
        displayName: member?.name ?? p.name,
      };
    });
  }, [members, participants]);

  const topContributors = contributionRows.slice(0, 3);

  const runningPollCount = useMemo(() => {
    if (!pollQuery.latestRunningPoll) return 0;
    // Count active polls by finding other running polls in messages
    return 1; // For now, show at least 1 if there's a latest running poll
  }, [pollQuery.latestRunningPoll]);

  const latestPollQuestion = pollQuery.latestRunningPoll?.data?.poll?.question ?? "";

  const notesCount = notesQuery.data?.length ?? 0;
  const latestNote = notesQuery.data?.[0];

  const settlementStatus: "ready" | "active" | "settled" | "none" = useMemo(() => {
    if (isPlanSettled || isPlanArchived) return "settled";
    if (activeFinalSettlementRound) return "active";
    if (canSettle && !allBalancesZero) return "ready";
    return "none";
  }, [activeFinalSettlementRound, allBalancesZero, canSettle, isPlanArchived, isPlanSettled]);

  const openSettlement = (settlementId?: string, createMode?: "direct-split" | "balance-settlement") => replacePanel({ type: "settlement", settlementId, createMode });
  const openCrew = () => replacePanel({ type: "crew" });
  const openExpenses = () => replacePanel({ type: "expenses" });
  const openPolls = () => replacePanel({ type: "polls" });
  const openNotes = () => replacePanel({ type: "notes" });
  const openInvite = () => replacePanel({ type: "invite", source: "overview" });
  const openUpNext = () => replacePanel({ type: "next-action" });
  const openPlanDetails = () => replacePanel({ type: "plan-details" });
  const openRecentActivity = () => replacePanel({ type: "recent-activity" });
  const openMemberProfile = (username?: string | null, source: "overview" | "crew" = "overview") => {
    const targetUsername = username?.trim();
    if (!targetUsername) return;
    replacePanel({ type: "member-profile", username: targetUsername, source });
  };
  const openAddExpenseFlow = () => {
    if (!eventId || expensesLocked) return;
    replacePanel({ type: "add-expense", source: "overview" });
  };
  const openInviteFlow = () => {
    if (invitesLocked) return;
    openInvite();
  };

  return (
    <PanelShell>
      <div className={cn("flex items-center justify-between gap-4 rounded-t-[inherit] border-b border-neutral-200 bg-neutral-50 px-6 py-4 dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]", isMobile && "px-3 py-2")}>
        <p className={cn("font-semibold tracking-tight text-foreground", isMobile ? "text-lg" : "text-xl")}>Overview</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 rounded-md transition hover:bg-[hsl(var(--surface-2))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            isMobile ? "h-8 w-8" : "h-9 w-9",
          )}
          onClick={closePanel}
          aria-label="Close panel"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </Button>
      </div>

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-2.5 px-3 pb-[4.5rem] pt-2.5")}>
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to see its overview.
          </div>
        ) : null}

        {eventId && !plan ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
            Loading plan overview...
          </div>
        ) : null}

        {plan ? (
          <div className="space-y-4">
            {/* Plan header */}
            <div>
              <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
              {plan.locationName && <p className="text-sm text-muted-foreground">{plan.locationName}</p>}
              {plan.date && <p className="text-sm text-muted-foreground">{formatFullDate(plan.date)}</p>}
            </div>

            {/* Attendance Card */}
            <StatCard
              icon="👥"
              title="Attendance"
              stat={`${confirmedCount}/${attendanceCount}`}
              description={pendingCount > 0 ? `${pendingCount} pending` : "All confirmed"}
              buttonLabel="View members"
              onButtonClick={openCrew}
            >
              <AvatarList
                participants={enrichedParticipants}
                onClickAvatar={(username) => openMemberProfile(username)}
              />
            </StatCard>

            {/* Expenses Card */}
            <StatCard
              icon="💸"
              title="Shared Expenses"
              stat={formatCurrency(totalShared, currency)}
              description={`${expenses.length} expense${expenses.length === 1 ? "" : "s"}`}
              buttonLabel="See all"
              onButtonClick={openExpenses}
            >
              {topContributors.length > 0 && (
                <div className="space-y-2 text-sm">
                  {topContributors.map((person) => (
                    <div key={person.id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{person.firstName}</span>
                      <span className="font-medium text-foreground">{formatCurrency(person.totalPaid, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </StatCard>

            {/* Polls Card */}
            <StatCard
              icon="🗳️"
              title="Active Polls"
              stat={String(runningPollCount)}
              description={latestPollQuestion ? `Latest: ${latestPollQuestion}` : "No active polls"}
              buttonLabel="View polls"
              onButtonClick={openPolls}
            />

            {/* Notes Card */}
            <StatCard
              icon="📝"
              title="Notes"
              stat={String(notesCount)}
              description={notesCount === 0 ? "No notes yet" : ""}
              buttonLabel="Read notes"
              onButtonClick={openNotes}
            >
              {latestNote && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {latestNote.body ?? latestNote.title ?? ""}
                </p>
              )}
            </StatCard>

            {/* Settlement Card */}
            {settlementStatus !== "none" && (
              <StatCard
                icon="🔄"
                title="Settlement"
                stat={
                  settlementStatus === "settled"
                    ? "Settled"
                    : settlementStatus === "active"
                      ? "In Progress"
                      : "Ready"
                }
                description={
                  settlementStatus === "settled"
                    ? "All balances settled"
                    : settlementStatus === "active"
                      ? `${unpaidTransfers} unresolved`
                      : "Ready to settle"
                }
                buttonLabel={settlementStatus === "settled" ? "View details" : "Settle"}
                onButtonClick={() => openSettlement()}
              />
            )}
          </div>
        ) : null}
      </div>
    </PanelShell>
  );
}

export default OverviewPanel;
