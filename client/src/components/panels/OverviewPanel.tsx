import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Crown, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { apiRequest } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatFullDate } from "@/lib/dates";
import { computeSplit } from "@/lib/split/calc";
import { queryKeys } from "@/lib/query-keys";
import { circularActionButtonClass, cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { buildCrewContributionRows } from "@/components/panels/crew-contribution";
import { useEventGuests } from "@/hooks/use-event-guests";
import { usePlanActivity } from "@/hooks/use-plan-activity";
import { formatActivityPreview, formatActivityTime, getActivityIcon } from "@/components/panels/activity-format";
import { getClientPlanStatus, getPlanFinalState, getPlanWrapUpEndsAt } from "@/lib/plan-lifecycle";
import { deriveSplannoBuddyPanelModel, type SplannoBuddyAction } from "@/lib/splanno-buddy";
import { SplannoBuddyCard } from "@/components/buddy/SplannoBuddyCard";

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

export function OverviewPanel() {
  const eventId = useActiveEventId();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { closePanel, replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
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
  const activityQuery = usePlanActivity(eventId, !!eventId);
  const activityItems = activityQuery.latestItems;
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
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

  const topPayerId = contributionRows[0]?.id ?? null;
  const visibleContributors = contributionRows.slice(0, isMobile ? 3 : 5);
  const hiddenContributorCount = Math.max(contributionRows.length - visibleContributors.length, 0);
  const visibleActivityItems = activityItems.slice(0, isMobile ? 2 : 3);

  const openSettlement = (settlementId?: string, createMode?: "direct-split" | "balance-settlement") => replacePanel({ type: "settlement", settlementId, createMode });
  const openCrew = () => replacePanel({ type: "crew" });
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
  const splannoBuddy = useMemo(() => deriveSplannoBuddyPanelModel({
    expenseCount: expenses.length,
    participantCount: participants.length,
    pendingCount: pendingInvites.length,
    planStatus: plan?.status ?? null,
    canSettle: isFinanciallyCompleted ? false : canSettle && !allBalancesZero,
    hasActiveSettlement: !!activeFinalSettlementRound,
    unpaidTransfers,
    eventDate: plan?.date ?? null,
    isCreator,
    settledAt: plan?.settledAt ?? null,
    createdAt: plan?.createdAt ?? null,
  }), [
    activeFinalSettlementRound,
    allBalancesZero,
    canSettle,
    expenses.length,
    isCreator,
    isFinanciallyCompleted,
    participants.length,
    pendingInvites.length,
    plan?.createdAt,
    plan?.date,
    plan?.settledAt,
    plan?.status,
    unpaidTransfers,
  ]);
  const handleBuddyAction = useCallback((action: SplannoBuddyAction) => {
    switch (action.intent) {
      case "overview":
        replacePanel({ type: "overview" });
        break;
      case "expenses":
        replacePanel({ type: "expenses" });
        break;
      case "crew":
        openCrew();
        break;
      case "invite":
        openInviteFlow();
        break;
      case "settlement":
        openSettlement();
        break;
      case "add-expense":
        openAddExpenseFlow();
        break;
      case "plan-details":
        openPlanDetails();
        break;
      case "chat":
        openRecentActivity();
        break;
      default:
        break;
    }
  }, [openAddExpenseFlow, openCrew, openInviteFlow, openPlanDetails, openRecentActivity, openSettlement, replacePanel]);

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
          <>
            <section className={cn("space-y-4", isMobile && "space-y-3")}>
            {isFinanciallyCompleted ? (
              <section
                className={cn(
                  "rounded-[18px] border border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10",
                  isMobile && "p-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-background/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-background/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isPlanArchived ? "Plan archived" : "Plan completed 🎉"}
                    </div>
                    <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">All balances settled</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatCurrency(totalShared, currency)} shared across {expenses.length} expense{expenses.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {participants.length} people participated
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isPlanArchived
                        ? "The wrap-up window has ended. This plan is now fully read-only."
                        : `All balances are settled. Chat stays open until ${wrapUpEndsLabel ?? "soon"}.`}
                    </p>
                  </div>
                  {planCompletedAt ? (
                    <div className="rounded-xl border border-emerald-200/70 bg-background/70 px-3 py-2 text-right dark:border-emerald-500/20 dark:bg-background/10">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{finalPlanState?.label ?? "Completed"}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{planCompletedAt}</p>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-background/60 px-3 py-3 dark:bg-[hsl(var(--surface-2))]/65">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{planCreatedAt ?? "Unavailable"}</p>
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-background/60 px-3 py-3 dark:bg-[hsl(var(--surface-2))]/65">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Final payment</p>
                    {finalPayment ? (
                      <>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          <span>{finalPayment.fromName || "Someone"}</span>
                          <span className="text-muted-foreground"> → </span>
                          <span>{finalPayment.toName || "Someone"}</span>
                        </p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatCurrency(Number(finalPayment.amount || 0), finalPayment.currency || currency)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Settlement completed successfully.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : isPlanClosed ? (
              <section
                className={cn(
                  "rounded-[18px] border border-amber-200/80 bg-amber-50/80 p-4 dark:border-amber-500/25 dark:bg-amber-500/10",
                  isMobile && "p-3",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-background/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-background/15 dark:text-amber-300">
                      Plan closed
                    </div>
                    <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">Planning is read-only now</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No new invites or expenses can be added. You can still finish settle up if balances remain.
                    </p>
                  </div>
                </div>
              </section>
            ) : isPlanArchived ? null : (
              <section
                role="button"
                tabIndex={0}
                onClick={openUpNext}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openUpNext();
                  }
                }}
                className={cn(
                  "interactive-card rounded-[18px] border border-primary/15 bg-primary/10 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[linear-gradient(180deg,hsl(var(--surface-2)),hsl(var(--surface-1)))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
                  isMobile && "p-0",
                )}
              >
                <SplannoBuddyCard
                  label="Splann-O"
                  title={undefined}
                  intent={splannoBuddy.intent}
                  chipLabel={splannoBuddy.intent === "resolve" ? splannoBuddy.chipLabel : null}
                  summary={splannoBuddy.summary}
                  primaryAttention={splannoBuddy.primaryAttention}
                  stats={splannoBuddy.stats}
                  actions={splannoBuddy.actions}
                  onAction={(action) => {
                    handleBuddyAction(action);
                  }}
                  openLabel="Open assistant"
                  onOpen={(eventId ? openUpNext : undefined)}
                  className={cn(
                    "w-full rounded-[18px] border-0 bg-transparent p-0 shadow-none backdrop-blur-0 dark:bg-transparent",
                    isMobile ? "min-h-0" : "min-h-0",
                  )}
                />
              </section>
            )}

            <section
              role="button"
              tabIndex={0}
              onClick={openCrew}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openCrew();
                }
              }}
              className={cn(
                "interactive-card w-full rounded-[18px] border border-black/5 bg-background/96 p-4 text-left hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/96 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:bg-[hsl(var(--surface-2))]",
                isMobile && "p-3",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold tracking-tight text-foreground">Crew contribution</p>
                  {!isMobile ? <p className="mt-1 text-xs text-muted-foreground">Who is currently carrying most of the shared spend</p> : null}
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn("mt-5 flex items-start gap-3 overflow-x-auto pb-1 pt-1", isMobile && "mt-3 gap-2")}>
                {visibleContributors.map((person: { id: number; name: string; firstName: string; totalPaid: number; tint: string; avatarUrl?: string | null; displayName?: string; username?: string | null }) => (
                  <div key={`overview-contributor-${person.id}`} className={cn("min-w-[64px] text-center", isMobile && "min-w-[54px]")}>
                    <div className="relative mx-auto w-fit">
                      {person.username ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openMemberProfile(person.username, "overview");
                          }}
                          className="block cursor-pointer rounded-full transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[hsl(var(--surface-2))]"
                          aria-label={`Open ${person.displayName || person.name}'s profile`}
                        >
                          <Avatar className={cn(
                            isMobile ? "h-10 w-10 border border-border/70 shadow-sm" : "h-12 w-12 border border-border/70 shadow-sm",
                            person.id === topPayerId && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background dark:ring-offset-[hsl(var(--surface-2))]",
                            "hover:ring-2 hover:ring-primary/35",
                          )}>
                            {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
                            <AvatarFallback className={cn("text-sm font-semibold", person.tint)}>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      ) : (
                        <Avatar className={cn(
                            isMobile ? "h-10 w-10 border border-border/70 shadow-sm" : "h-12 w-12 border border-border/70 shadow-sm",
                          person.id === topPayerId && "ring-2 ring-primary/70 ring-offset-2 ring-offset-background dark:ring-offset-[hsl(var(--surface-2))]",
                        )}>
                          {person.avatarUrl ? <AvatarImage src={resolveAssetUrl(person.avatarUrl) ?? person.avatarUrl} alt={person.displayName || person.name} /> : null}
                          <AvatarFallback className={cn("text-sm font-semibold", person.tint)}>
                            {getInitials(person.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {person.id === topPayerId ? (
                        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-slate-900 shadow-sm">
                          <Crown className="h-3 w-3" />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-xs font-medium text-foreground">{person.firstName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(person.totalPaid, currency)}</p>
                  </div>
                ))}
                {hiddenContributorCount > 0 ? (
                  <div className="min-w-[64px] text-center">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-dashed border-border/70 bg-background text-xs font-semibold text-muted-foreground dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-2))]/90">
                      +{hiddenContributorCount}
                    </div>
                    <p className="mt-2 text-xs font-medium text-foreground">more</p>
                  </div>
                ) : null}
              </div>
            </section>

            {!isMobile ? (
              <section
                role="button"
                tabIndex={0}
                onClick={openRecentActivity}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openRecentActivity();
                  }
                }}
                className="interactive-card rounded-[18px] border border-black/5 bg-background/96 p-4 hover:border-border/80 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-[hsl(var(--border-subtle))] dark:bg-[hsl(var(--surface-1))]/96 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:bg-[hsl(var(--surface-2))]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold tracking-tight text-foreground">Recent activity</p>
                    <p className="mt-1 text-xs text-muted-foreground">The latest moments from the plan</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    View all
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {visibleActivityItems.length > 0 ? visibleActivityItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-background/40 dark:hover:bg-[hsl(var(--surface-2))]/90">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[hsl(var(--surface-2))] text-sm dark:bg-[hsl(var(--surface-2))]/95">
                        {getActivityIcon(item.type)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-sm font-medium leading-5 text-foreground">
                            <span className="line-clamp-2">{formatActivityPreview(item, currency)}</span>
                          </p>
                          <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
                            {formatActivityTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </li>
                  )) : (
                    <li className="rounded-xl bg-background/40 px-2 py-3 text-sm text-muted-foreground dark:bg-[hsl(var(--surface-2))]/90">No activity yet.</li>
                  )}
                </ul>
              </section>
            ) : null}
            </section>
          </>
        ) : null}
      </div>
    </PanelShell>
  );
}

export default OverviewPanel;
