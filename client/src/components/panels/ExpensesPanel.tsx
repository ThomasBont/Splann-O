import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Plus, Receipt, Scale } from "lucide-react";
import type { ExpenseWithParticipant } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { useCheckoutSettlementTransfer } from "@/hooks/use-bbq-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { planQueryKey, usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { apiFetch, apiRequest } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/asset-url";
import { formatFullDate } from "@/lib/dates";
import { getClientPlanStatus, getPlanFinalState, getPlanWrapUpEndsAt } from "@/lib/plan-lifecycle";
import { queryKeys } from "@/lib/query-keys";
import { computeSplit } from "@/lib/split/calc";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";
import { PanelHeader, PanelSection, PanelShell, panelHeaderAddButtonClass, useActiveEventId } from "@/components/panels/panel-primitives";

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
  return `€${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCreated(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function initials(value?: string | null) {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
}

type SettlementRoundSummary = {
  id: string;
  title: string;
  roundType: "balance_settlement" | "direct_split";
  status: "active" | "completed" | "cancelled";
  currency: string | null;
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

type ExpensePaymentStatus = "open" | "settled";
type PanelExpense = ReturnType<typeof normalizePanelExpense>;

function normalizePanelExpense(
  expense: ExpenseWithParticipant,
  paymentStatus: ExpensePaymentStatus,
) {
  const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
  const excludedFromFinalSettlement = Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
  const settledAt = (expense as { settledAt?: string | Date | null }).settledAt ?? null;
  const linkedSettlementRoundId = String((expense as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? "").trim();
  return {
    ...expense,
    amount: Number(expense.amount || 0),
    resolutionMode,
    excludedFromFinalSettlement,
    settledAt,
    linkedSettlementRoundId,
    paymentStatus,
    isSettled: paymentStatus === "settled",
  };
}

function ExpenseListRow({
  expense,
  currency,
  memberByUserId,
  onOpen,
  isMobile,
}: {
  expense: PanelExpense;
  currency: string;
  memberByUserId: Map<number, { avatarUrl?: string | null }>;
  onOpen: (expenseId: number) => void;
  isMobile: boolean;
}) {
  const payerName = String(expense.participantName || "Unknown").trim() || "Unknown";
  const member = expense.participantUserId ? memberByUserId.get(Number(expense.participantUserId)) : undefined;
  const avatarUrl = resolveAssetUrl(member?.avatarUrl ?? null) ?? member?.avatarUrl ?? "";

  return (
    <button
      type="button"
      key={`expenses-panel-${expense.id}`}
      onClick={() => onOpen(expense.id)}
      className={cn(
        "group w-full cursor-pointer rounded-xl border-b border-[hsl(var(--border-subtle))] px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "bg-transparent hover:bg-muted/30",
        isMobile && "rounded-[18px] border border-border/60 bg-background/80 px-3 py-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-foreground">
            {expense.item || "Expense"}
          </p>
          {isMobile ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Paid by {payerName}</p>
          ) : null}
        </div>
        <span className={cn("shrink-0 font-semibold text-foreground", isMobile ? "text-[17px]" : "text-lg")}>
          {formatCurrency(expense.amount, currency)}
        </span>
      </div>
      <div className={cn("mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", isMobile && "mt-1.5")}>
        <Avatar className="h-5 w-5 shrink-0">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={payerName} /> : null}
          <AvatarFallback className="bg-primary/10 text-[9px] font-semibold text-primary">
            {initials(payerName)}
          </AvatarFallback>
        </Avatar>
        {!isMobile ? <span className="truncate">{payerName}</span> : null}
        {!isMobile ? <span aria-hidden>·</span> : null}
        <span className="shrink-0">{formatCreated(expense.createdAt ? String(expense.createdAt) : null)}</span>
      </div>
    </button>
  );
}

function SettleNowExpenseRow({
  expense,
  currency,
  memberByUserId,
  onOpen,
  isMobile,
}: {
  expense: PanelExpense;
  currency: string;
  memberByUserId: Map<number, { avatarUrl?: string | null }>;
  onOpen: (expenseId: number) => void;
  isMobile: boolean;
}) {
  const { user } = useAuth();
  const { toastError } = useAppToast();
  const checkoutTransfer = useCheckoutSettlementTransfer();
  const payerName = String(expense.participantName || "Unknown").trim() || "Unknown";
  const member = expense.participantUserId ? memberByUserId.get(Number(expense.participantUserId)) : undefined;
  const avatarUrl = resolveAssetUrl(member?.avatarUrl ?? null) ?? member?.avatarUrl ?? "";
  const settlementId = expense.linkedSettlementRoundId;
  const settlementQuery = useQuery<SettlementDetailResponse>({
    queryKey: queryKeys.plans.settlementDetail(expense.barbecueId, settlementId || null),
    queryFn: async () => {
      return apiRequest<SettlementDetailResponse>(`/api/events/${expense.barbecueId}/settlement/${encodeURIComponent(settlementId)}`);
    },
    enabled: !!expense.barbecueId && !!settlementId,
    staleTime: 15_000,
    refetchInterval: settlementId && expense.paymentStatus === "open" ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const transfers = settlementQuery.data?.transfers ?? [];
  const isPaid = expense.paymentStatus === "settled";
  const handlePay = async (transferId: string) => {
    try {
      const result = await checkoutTransfer.mutateAsync({
        eventId: expense.barbecueId,
        transferId,
        expenseId: expense.id,
      });
      if (!result.checkoutUrl) throw new Error("Payment URL missing");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === "only_payer_can_pay") {
        toastError("Only the person who owes can start this payment.");
        return;
      }
      if (err.code === "transfer_paid") {
        toastError("This payment is already completed.");
        return;
      }
      toastError(err.message || "Unable to start payment");
    }
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(expense.id)}
      className={cn(
        "group w-full cursor-pointer rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isPaid
          ? "border-emerald-200/80 bg-emerald-50/80 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
          : "border-amber-200/80 bg-amber-50/85 hover:bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10",
        isMobile && "rounded-[20px] px-3 py-3",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-medium text-foreground">{expense.item || "Expense"}</p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                isPaid
                  ? "border-emerald-200 bg-background/75 text-emerald-700 dark:border-emerald-500/30 dark:bg-background/15 dark:text-emerald-300"
                  : "border-amber-200 bg-background/75 text-amber-700 dark:border-amber-500/30 dark:bg-background/15 dark:text-amber-300",
              )}
            >
              {isPaid ? "Paid" : "Awaiting payment"}
            </span>
          </div>
          {isMobile ? (
            <p className="mt-1 text-[11px] text-muted-foreground">Paid by {payerName}</p>
          ) : null}
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar className="h-5 w-5 shrink-0">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt={payerName} /> : null}
              <AvatarFallback className={cn(
                "text-[9px] font-semibold",
                isPaid ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
              )}>
                {initials(payerName)}
              </AvatarFallback>
            </Avatar>
            {!isMobile ? <span className="truncate">{payerName}</span> : null}
            {!isMobile ? <span aria-hidden>·</span> : null}
            <span className="shrink-0">{formatCreated(expense.createdAt ? String(expense.createdAt) : null)}</span>
          </div>
        </div>
        <span className={cn("shrink-0 font-semibold text-foreground", isMobile ? "text-[17px]" : "text-lg")}>
          {formatCurrency(expense.amount, currency)}
        </span>
      </div>
      {isPaid ? null : (
        <div className="mt-3 rounded-xl border border-amber-200/80 bg-background/70 px-3 py-2.5 dark:border-amber-500/20 dark:bg-background/10">
          {transfers.length > 0 ? (
            <div className="space-y-2">
              {transfers.map((transfer) => {
                const canPay = !transfer.paidAt && Number(user?.id ?? 0) === transfer.fromUserId;
                return (
                  <div key={`settle-now-transfer-${expense.id}-${transfer.id}`} className={cn("flex items-center justify-between gap-3", isMobile && "items-start")}>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Direct payback</p>
                      <p className="min-w-0 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{transfer.fromName || "Someone"}</span>
                        {" owes "}
                        <span className="font-medium text-foreground">{transfer.toName || "Someone"}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)}
                      </p>
                    {canPay ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 border-amber-300 bg-amber-100/70 px-2.5 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handlePay(transfer.id);
                        }}
                        disabled={checkoutTransfer.isPending}
                      >
                        Pay
                      </Button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-muted-foreground">Waiting for payment</span>
                    )}
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground">
                Payment still outstanding.
              </p>
            </div>
          ) : settlementQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading payment details…</p>
          ) : (
            <p className="text-xs text-muted-foreground">Payment details unavailable.</p>
          )}
        </div>
      )}
    </button>
  );
}

export function ExpensesPanel() {
  const isMobile = useIsMobile();
  const eventId = useActiveEventId();
  const { replacePanel } = usePanel();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const checkoutTransfer = useCheckoutSettlementTransfer();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];
  const sharedExpenses = useMemo(
    () => expenses.filter((expense) => {
      const resolutionMode = String((expense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase();
      const excluded = Boolean((expense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement);
      return !excluded && resolutionMode !== "now";
    }),
    [expenses],
  );
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const totalShared = sharedExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const splitExpenses = useMemo(
    () => sharedExpenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [sharedExpenses],
  );
  const memberByUserId = useMemo(
    () => new Map(members.map((member) => [Number(member.userId), member])),
    [members],
  );
  const memberByName = useMemo(
    () => new Map(members.map((member) => [String(member.name ?? "").trim().toLowerCase(), member])),
    [members],
  );
  const { settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const { balances } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const visibleBalanceRows = useMemo(
    () => settlements.filter((entry) => Number(entry.amount) > 0).slice(0, 8),
    [settlements],
  );
  const balanceRows = useMemo(
    () => balances
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        balance: Number(entry.balance) || 0,
      }))
      .sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name)),
    [balances],
  );
  const maxAbsBalance = useMemo(
    () => Math.max(0, ...balanceRows.map((entry) => Math.abs(entry.balance))),
    [balanceRows],
  );
  const allBalancesSettled = sharedExpenses.length > 0 && visibleBalanceRows.length === 0;
  const planStatus = getClientPlanStatus(plan?.status);
  const isPlanClosed = planStatus === "closed";
  const isPlanSettled = planStatus === "settled";
  const isPlanArchived = planStatus === "archived";
  const isFinanciallyCompleted = isPlanSettled || isPlanArchived;
  const planCreatedAt = formatFullDate((plan as { createdAt?: string | Date | null } | null)?.createdAt ?? null);
  const finalPlanState = getPlanFinalState(plan?.status, (plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const planCompletedAt = formatFullDate(finalPlanState?.at ?? null);
  const wrapUpEndsAt = getPlanWrapUpEndsAt((plan as { settledAt?: string | Date | null } | null)?.settledAt ?? null);
  const wrapUpEndsLabel = formatFullDate(wrapUpEndsAt);
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const [confirmSettleUpOpen, setConfirmSettleUpOpen] = useState(false);
  const settlementRoundsQueryKey = queryKeys.plans.settlements(eventId);
  const settlementRoundsQuery = useQuery<SettlementRoundsResponse>({
    queryKey: settlementRoundsQueryKey,
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
  const activeFinalSettlementRound = settlementRoundsQuery.data?.activeFinalSettlementRound ?? null;
  const canStartSettlement = isCreator
    && !activeFinalSettlementRound
    && sharedExpenses.length > 0
    && visibleBalanceRows.length > 0;
  const expensesLocked = isPlanClosed || isFinanciallyCompleted || !!activeFinalSettlementRound;
  const latestPastFinalSettlementRound = settlementRoundsQuery.data?.pastFinalSettlementRounds?.[0] ?? null;
  const displayedSettlementId = activeFinalSettlementRound?.id ?? latestPastFinalSettlementRound?.id ?? null;
  const settlementDetailQueryKey = queryKeys.plans.settlementDetail(eventId, displayedSettlementId);
  const settlementDetailQuery = useQuery<SettlementDetailResponse>({
    queryKey: settlementDetailQueryKey,
    queryFn: async () => {
      if (!eventId || !displayedSettlementId) {
        return {
          settlement: null,
          transfers: [],
          summary: { transferCount: 0, paidTransfersCount: 0, totalAmount: 0, outstandingAmount: 0 },
        };
      }
      return apiRequest<SettlementDetailResponse>(`/api/events/${eventId}/settlement/${encodeURIComponent(displayedSettlementId)}`);
    },
    enabled: !!eventId && !!displayedSettlementId,
    staleTime: 15_000,
    refetchInterval: eventId && displayedSettlementId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });
  const activeSettlement = settlementDetailQuery.data?.settlement ?? null;
  const settlementTransfers = settlementDetailQuery.data?.transfers ?? [];
  const settlementSummary = settlementDetailQuery.data?.summary ?? {
    transferCount: 0,
    paidTransfersCount: 0,
    totalAmount: 0,
    outstandingAmount: 0,
  };
  const settlementIsComplete = activeSettlement?.status === "completed"
    || (settlementTransfers.length > 0 && settlementTransfers.every((transfer) => !!transfer.paidAt));
  const quickSettlementStatusById = useMemo(() => {
    const statusById = new Map<string, ExpensePaymentStatus>();
    const activeQuickSettleRound = settlementRoundsQuery.data?.activeQuickSettleRound ?? null;
    if (activeQuickSettleRound?.id) {
      statusById.set(activeQuickSettleRound.id, activeQuickSettleRound.status === "completed" ? "settled" : "open");
    }
    for (const round of settlementRoundsQuery.data?.pastQuickSettleRounds ?? []) {
      if (!round.id) continue;
      statusById.set(round.id, round.status === "completed" ? "settled" : "open");
    }
    if (activeSettlement?.roundType === "direct_split" && activeSettlement.id) {
      statusById.set(activeSettlement.id, settlementIsComplete ? "settled" : "open");
    }
    return statusById;
  }, [
    activeSettlement?.id,
    activeSettlement?.roundType,
    settlementIsComplete,
    settlementRoundsQuery.data?.activeQuickSettleRound,
    settlementRoundsQuery.data?.pastQuickSettleRounds,
  ]);
  const sortedExpenses = useMemo(
    () => [...expenses]
      .map((expense) => {
        const linkedSettlementRoundId = String((expense as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? "").trim();
        const settledAt = (expense as { settledAt?: string | Date | null }).settledAt ?? null;
        const paymentStatus: ExpensePaymentStatus =
          isFinanciallyCompleted
            ? "settled"
            : linkedSettlementRoundId
              ? (quickSettlementStatusById.get(linkedSettlementRoundId) ?? (settledAt ? "settled" : "open"))
              : settledAt
                ? "settled"
                : "open";
        return normalizePanelExpense(expense, paymentStatus);
      })
      .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime()),
    [expenses, isFinanciallyCompleted, quickSettlementStatusById],
  );
  const sharedGroupExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expense.resolutionMode !== "now" && !expense.linkedSettlementRoundId),
    [sortedExpenses],
  );
  const settleNowExpenses = useMemo(
    () => sortedExpenses.filter((expense) => expense.resolutionMode === "now" || !!expense.linkedSettlementRoundId),
    [sortedExpenses],
  );
  const totalExpenseCount = sharedGroupExpenses.length + settleNowExpenses.length;
  const sharedExpenseBreakdownLabel = `${sharedGroupExpenses.length} shared group ${sharedGroupExpenses.length === 1 ? "expense" : "expenses"}`;
  const settleNowBreakdownLabel = `${settleNowExpenses.length} settle now ${settleNowExpenses.length === 1 ? "expense" : "expenses"}`;

  const createSettlement = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Event not found");
      const res = await apiFetch(`/api/events/${eventId}/settlement/manual`, {
        method: "POST",
        body: { scopeType: "everyone", selectedParticipantIds: null },
      });
      const body = await res.json().catch(() => ({} as { code?: string; message?: string }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to create settlement") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as { latest?: SettlementDetailResponse };
    },
    onSuccess: async () => {
      setConfirmSettleUpOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planQueryKey(eventId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() }),
        queryClient.invalidateQueries({ queryKey: settlementRoundsQueryKey }),
        queryClient.invalidateQueries({ queryKey: settlementDetailQueryKey }),
      ]);
      toastSuccess("Settlement created");
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_creator_can_start_settlement") {
        toastError("Only the event creator can create a settlement.");
        return;
      }
      if (err.code === "active_settlement_exists") {
        toastError("There is already an active settlement.");
        return;
      }
      toastError(err.message || "Couldn’t create settlement.");
    },
  });

  const markGroupTransferPaid = useMutation({
    mutationFn: async ({ settlementId, transferId }: { settlementId: string; transferId: string }) => {
      if (!eventId) throw new Error("Event not found");
      const res = await apiFetch(`/api/events/${eventId}/settlement/${settlementId}/transfers/${transferId}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { code?: string; message?: string }));
        const error = new Error(body.message || "Failed to mark payment as paid") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return res.json() as Promise<{ transferId: string; paidAt: string | null }>;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: planQueryKey(eventId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.plans.list() }),
        queryClient.invalidateQueries({ queryKey: settlementRoundsQueryKey }),
        queryClient.invalidateQueries({ queryKey: settlementDetailQueryKey }),
      ]);
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_payer_can_pay") {
        toastError("Only the person who owes can initiate this payment.");
        return;
      }
      toastError(err.message || "Couldn’t mark payment as paid.");
    },
  });
  const handleSettlementStripePay = async (transferId: string) => {
    try {
      if (!eventId) throw new Error("Event not found");
      const result = await checkoutTransfer.mutateAsync({ eventId, transferId });
      if (!result.checkoutUrl) throw new Error("Payment URL missing");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === "only_payer_can_pay") {
        toastError("Only the person who owes can start this payment.");
        return;
      }
      if (err.code === "transfer_paid") {
        toastError("This payment is already completed.");
        return;
      }
      toastError(err.message || "Unable to start payment");
    }
  };

  const handleAddExpense = () => {
    if (!eventId || expensesLocked) return;
    replacePanel({ type: "add-expense", source: "expenses" });
  };
  const openExpenseDetail = (expenseId: number) => {
    replacePanel({ type: "expense", id: String(expenseId) });
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Expenses"
        title="Shared expenses"
        actions={(
          <div className={cn("items-center gap-2", isMobile ? "hidden" : "flex")}>
            {!activeFinalSettlementRound && !isFinanciallyCompleted ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-border/70 bg-muted/40 text-foreground hover:bg-muted/70"
                onClick={() => setConfirmSettleUpOpen(true)}
                disabled={!canStartSettlement || createSettlement.isPending}
                title={isCreator ? "Settle up" : "Only the creator can settle up"}
              >
                {createSettlement.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scale className="mr-1.5 h-4 w-4" />}
                Settle Up
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              className={panelHeaderAddButtonClass()}
              onClick={handleAddExpense}
              disabled={!eventId || expensesLocked}
              title={isFinanciallyCompleted ? "Plan completed" : isPlanClosed ? "Plan closed" : activeFinalSettlementRound ? "Settlement in progress" : "Add expense"}
            >
              Add Expense +
            </Button>
          </div>
        )}
        meta={(
          <div className="space-y-0.5">
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="font-medium text-foreground">{plan?.name ?? "Current plan"}</span>
            </span>
            {totalExpenseCount > 0 ? (
              <span className="block text-xs text-muted-foreground">
                {totalExpenseCount} {totalExpenseCount === 1 ? "expense" : "expenses"} total
              </span>
            ) : null}
          </div>
        )}
      />

      <div className={cn("flex-1 space-y-4 overflow-y-auto px-5 py-5", isMobile && "space-y-3 px-3 pb-[4.5rem] pt-2.5")}>
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect shared money.
          </div>
        ) : (
          <>
            {sortedExpenses.length === 0 ? (
              <div className={cn(
                "rounded-xl border border-dashed border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/60 px-4 py-6 text-center",
                isMobile && "py-4",
              )}>
                <p className="text-sm font-medium text-foreground">
                  {isFinanciallyCompleted ? "Plan completed" : isPlanClosed ? "Plan closed" : "No expenses yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {expensesLocked
                    ? "New expenses are disabled for this plan."
                    : "Add the first expense when someone pays for the group or needs direct payback."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  onClick={handleAddExpense}
                  disabled={!eventId || expensesLocked}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add expense
                </Button>
              </div>
            ) : null}

            {sortedExpenses.length > 0 ? (
              <section className={cn(
                "rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/75 px-4 py-3 shadow-none",
                isMobile && "rounded-[18px] px-3.5 py-3",
              )}>
                <p className="text-base font-semibold text-foreground">
                  {totalExpenseCount} {totalExpenseCount === 1 ? "expense" : "expenses"} total
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sharedExpenseBreakdownLabel} • {settleNowBreakdownLabel}
                </p>
              </section>
            ) : null}

            {isMobile ? (
              <section className="sticky top-0 z-10 -mx-0.5 rounded-[22px] border border-primary/20 bg-background/95 p-1.5 shadow-[0_8px_22px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/88">
                <div className="mb-1 px-1">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Quick actions</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {!activeFinalSettlementRound && !isFinanciallyCompleted ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-[16px] border-border/70 bg-muted/40 text-sm font-semibold text-foreground hover:bg-muted/70"
                      onClick={() => setConfirmSettleUpOpen(true)}
                      disabled={!canStartSettlement || createSettlement.isPending}
                    >
                      {createSettlement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
                      Settle Up
                    </Button>
                  ) : (
                    <div className="flex h-11 items-center justify-center rounded-[16px] border border-border/60 bg-muted/30 px-3 text-sm font-medium text-muted-foreground">
                      Settlement in progress
                    </div>
                  )}
                  <Button
                    type="button"
                    className="h-11 rounded-[16px] bg-primary text-sm font-semibold text-slate-900 shadow-[0_10px_22px_rgba(245,166,35,0.2)] hover:bg-primary/90"
                    onClick={handleAddExpense}
                    disabled={!eventId || expensesLocked}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Expense
                  </Button>
                </div>
              </section>
            ) : null}

            {isFinanciallyCompleted && sharedExpenses.length > 0 ? (
              <section className={cn("rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-4 shadow-none dark:border-emerald-500/25 dark:bg-emerald-500/10", isMobile && "rounded-[18px] p-3.5")}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-background/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-background/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isPlanArchived ? "Plan archived" : "Plan completed 🎉"}
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{plan?.name ?? (isPlanArchived ? "Plan archived" : "Plan completed")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(totalShared, currency)} shared across {sharedExpenses.length} {sharedExpenses.length === 1 ? "expense" : "expenses"} by {participants.length} {participants.length === 1 ? "person" : "people"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPlanArchived
                        ? "All balances are settled. The wrap-up window has ended and the plan is now fully read-only."
                        : `All balances are settled. Chat stays open until ${wrapUpEndsLabel ?? "soon"}.`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-200/70 bg-background/70 px-3 py-2 text-right dark:border-emerald-500/20 dark:bg-background/10">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{finalPlanState?.label ?? "Completed"}</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{planCompletedAt ?? "Just now"}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/70 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{planCreatedAt ?? "Unavailable"}</p>
                  </div>
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/70 px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Final settlement result</p>
                    {settlementTransfers.length > 0 ? (
                      <div className="mt-1 space-y-1.5">
                        {settlementTransfers.slice(0, 3).map((transfer) => (
                          <div key={`completed-settlement-${transfer.id}`} className="flex items-center justify-between gap-3 text-sm">
                            <p className="min-w-0 truncate text-foreground">
                              <span className="font-medium">{transfer.fromName || "Someone"}</span>
                              <span className="text-muted-foreground"> → </span>
                              <span className="font-medium">{transfer.toName || "Someone"}</span>
                            </p>
                            <span className="shrink-0 font-semibold text-foreground">
                              {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)}
                            </span>
                          </div>
                        ))}
                        {settlementTransfers.length > 3 ? (
                          <p className="text-xs text-muted-foreground">+{settlementTransfers.length - 3} more paid transfers</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">All shared costs were settled.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {isPlanClosed && sharedExpenses.length > 0 ? (
              <section className={cn("rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 shadow-none dark:border-amber-500/25 dark:bg-amber-500/10", isMobile && "rounded-[18px] p-3.5")}>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-background/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-background/15 dark:text-amber-300">
                    Plan closed
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{plan?.name ?? "Plan closed"}</h3>
                  <p className="text-sm text-muted-foreground">
                    New expenses and member changes are locked. You can still review balances and start settle up if anything is still open.
                  </p>
                </div>
              </section>
            ) : null}

            {sharedExpenses.length > 0 && !isFinanciallyCompleted ? (
              <PanelSection title="Balances" variant="list">
                {balanceRows.length > 0 && !allBalancesSettled ? (
                  <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Negative owes · positive gets paid
                      </p>
                    </div>
                    <div className={cn("space-y-2", isMobile && "space-y-2.5")}>
                      {balanceRows.map((entry) => {
                        const member = memberByName.get(entry.name.trim().toLowerCase());
                        const avatarUrl = resolveAssetUrl(member?.avatarUrl ?? null) ?? member?.avatarUrl ?? "";
                        const ratio = maxAbsBalance > 0 ? Math.min(1, Math.abs(entry.balance) / maxAbsBalance) : 0;
                        const barWidth = `${Math.max(0, Math.round(ratio * 50))}%`;
                        const isPositive = entry.balance > 0.009;
                        const isNegative = entry.balance < -0.009;
                        const amountLabel = `${isNegative ? "-" : isPositive ? "+" : ""}${formatCurrency(Math.abs(entry.balance), currency)}`;
                        return (
                          <div
                            key={`expenses-balance-chart-${entry.id}`}
                            className={cn(
                              "grid grid-cols-[minmax(0,132px)_minmax(0,1fr)_84px] items-center gap-3 rounded-lg px-1 py-1.5",
                              isMobile && "grid-cols-[minmax(0,110px)_minmax(0,1fr)_72px] gap-2",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Avatar className="h-6 w-6 shrink-0 border border-background/70">
                                {avatarUrl ? <AvatarImage src={avatarUrl} alt={entry.name} /> : null}
                                <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
                                  {initials(entry.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="min-w-0 truncate text-sm font-medium text-foreground">{entry.name}</span>
                            </div>
                            <div className="relative h-8 overflow-hidden rounded-lg bg-muted/30">
                              <div className="absolute inset-y-1 left-1/2 w-px -translate-x-1/2 bg-border/80" />
                              {isNegative ? (
                                <div
                                  className="absolute right-1/2 top-1/2 h-3.5 -translate-y-1/2 rounded-l-full rounded-r-sm bg-orange-400/85 dark:bg-orange-400/75"
                                  style={{ width: barWidth }}
                                />
                              ) : null}
                              {isPositive ? (
                                <div
                                  className="absolute left-1/2 top-1/2 h-3.5 -translate-y-1/2 rounded-l-sm rounded-r-full bg-emerald-500/85 dark:bg-emerald-400/75"
                                  style={{ width: barWidth }}
                                />
                              ) : null}
                              {!isPositive && !isNegative ? (
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                                  0
                                </div>
                              ) : null}
                            </div>
                            <div className="text-right">
                              <span
                                className={cn(
                                  "text-sm font-semibold tabular-nums",
                                  isNegative
                                    ? "text-orange-600 dark:text-orange-300"
                                    : isPositive
                                      ? "text-emerald-600 dark:text-emerald-300"
                                      : "text-muted-foreground",
                                )}
                              >
                                {amountLabel}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : allBalancesSettled ? (
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-4 text-center dark:border-emerald-500/25 dark:bg-emerald-500/10">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-background/80 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/25 dark:bg-background/20 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      All settled 🎉
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/60 px-4 py-4 text-sm text-muted-foreground">
                    Balances appear when shared costs create something to settle.
                  </div>
                )}
              </PanelSection>
            ) : null}

            {sharedExpenses.length > 0 && !isFinanciallyCompleted && (visibleBalanceRows.length > 0 || activeSettlement) ? (
              <section className={cn("rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3.5 shadow-none", isMobile && "rounded-[20px] p-3.5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {activeSettlement
                        ? (settlementIsComplete ? "Settlement completed" : "Settlement in progress")
                        : "Suggested settlement"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeSettlement
                        ? (settlementIsComplete
                          ? "All suggested payments have been marked paid."
                          : `${settlementSummary.paidTransfersCount}/${settlementSummary.transferCount} paid`)
                        : "Use this to turn the current balances into payments."}
                    </p>
                  </div>
                  {activeSettlement ? (
                    !settlementIsComplete ? (
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Completed
                      </span>
                    )
                  ) : null}
                </div>

                <div className="mt-3 space-y-2">
                  {(activeSettlement ? settlementTransfers : visibleBalanceRows).map((entry) => {
                    if (activeSettlement) {
                      const transfer = entry as SettlementDetailResponse["transfers"][number];
                      const currentUserId = Number(user?.id ?? 0);
                      const isDebtor = !transfer.paidAt && currentUserId > 0 && currentUserId === transfer.fromUserId;
                      const isReceiver = currentUserId > 0 && currentUserId === transfer.toUserId;
                      return (
                        <div
                          key={`expenses-settlement-transfer-${transfer.id}`}
                          className={cn(
                            "rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/70 px-3 py-2.5",
                            isMobile && "px-3 py-3",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Payment</p>
                              <p className="min-w-0 text-sm text-foreground">
                                <span className="font-medium">{transfer.fromName || "Someone"}</span>
                                <span className="text-muted-foreground"> owes </span>
                                <span className="font-medium">{transfer.toName || "Someone"}</span>
                              </p>
                            </div>
                            <span className="shrink-0 text-base font-semibold text-foreground">
                              {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)}
                            </span>
                          </div>
                          <div className="mt-2">
                            {transfer.paidAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Paid
                              </span>
                            ) : isDebtor ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void handleSettlementStripePay(transfer.id)}
                                  disabled={checkoutTransfer.isPending || settlementIsComplete}
                                >
                                  Pay with Stripe
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markGroupTransferPaid.mutate({ settlementId: transfer.settlementId, transferId: transfer.id })}
                                  disabled={markGroupTransferPaid.isPending || settlementIsComplete}
                                >
                                  Mark as paid
                                </Button>
                              </div>
                            ) : isReceiver ? (
                              <span className="text-xs text-muted-foreground">
                                You will receive {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)} from {transfer.fromName || "someone"}.
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Only the person who owes can complete this payment.
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const suggestion = entry as typeof visibleBalanceRows[number];
                    const debtor = memberByName.get(suggestion.from.trim().toLowerCase());
                    const creditor = memberByName.get(suggestion.to.trim().toLowerCase());
                    const debtorAvatarUrl = resolveAssetUrl(debtor?.avatarUrl ?? null) ?? debtor?.avatarUrl ?? "";
                    const creditorAvatarUrl = resolveAssetUrl(creditor?.avatarUrl ?? null) ?? creditor?.avatarUrl ?? "";
                    return (
                      <div
                        key={`expenses-balance-${suggestion.from}-${suggestion.to}-${suggestion.amount}`}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/70 px-3 py-2.5",
                          isMobile && "px-3 py-3",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Suggested payment</p>
                          <div className="mt-1 flex min-w-0 items-center gap-2">
                            <Avatar className="h-6 w-6 shrink-0 border border-background/70">
                              {debtorAvatarUrl ? <AvatarImage src={debtorAvatarUrl} alt={suggestion.from} /> : null}
                              <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
                                {initials(suggestion.from)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{suggestion.from}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <Avatar className="h-6 w-6 shrink-0 border border-background/70">
                              {creditorAvatarUrl ? <AvatarImage src={creditorAvatarUrl} alt={suggestion.to} /> : null}
                              <AvatarFallback className="bg-muted text-[9px] font-semibold text-foreground">
                                {initials(suggestion.to)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">{suggestion.to}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-base font-semibold text-foreground">
                          {formatCurrency(Number(suggestion.amount) || 0, currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {!activeSettlement ? (
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmSettleUpOpen(true)}
                      disabled={!canStartSettlement || createSettlement.isPending}
                    >
                      {createSettlement.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Start settlement
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {sharedGroupExpenses.length > 0 ? (
              <section className={cn("rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3.5 shadow-none", isMobile && "rounded-[20px] p-3.5")}>
                <div className={cn("space-y-1", isMobile && "space-y-0.5")}>
                  <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shared Group Expenses ({sharedGroupExpenses.length})
                  </h3>
                  {sharedGroupExpenses.map((expense) => (
                    <ExpenseListRow
                      key={`expenses-shared-${expense.id}`}
                      expense={expense}
                      currency={currency}
                      memberByUserId={memberByUserId}
                      onOpen={openExpenseDetail}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {settleNowExpenses.length > 0 ? (
              <section className={cn("rounded-2xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] p-3.5 shadow-none", isMobile && "rounded-[20px] p-3.5")}>
                <div className={cn("space-y-2", isMobile && "space-y-1.5")}>
                  <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Settle Now Expenses ({settleNowExpenses.length})
                  </h3>
                  {settleNowExpenses.map((expense) => (
                    <SettleNowExpenseRow
                      key={`expenses-settle-now-${expense.id}`}
                      expense={expense}
                      currency={currency}
                      memberByUserId={memberByUserId}
                      onOpen={openExpenseDetail}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
      <AlertDialog open={confirmSettleUpOpen} onOpenChange={setConfirmSettleUpOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create settlement?</AlertDialogTitle>
            <AlertDialogDescription>
              Create a settlement based on current expenses?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createSettlement.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void createSettlement.mutateAsync();
              }}
              disabled={createSettlement.isPending}
            >
              {createSettlement.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Create settlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelShell>
  );
}

export default ExpensesPanel;
