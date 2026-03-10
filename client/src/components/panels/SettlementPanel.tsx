import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Receipt, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { computeSplit } from "@/lib/split/calc";
import { usePanel } from "@/state/panel";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

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
    eventId: number;
    title: string;
    roundType: "balance_settlement" | "direct_split";
    scopeType: "everyone" | "selected";
    selectedParticipantIds: number[] | null;
    status: "active" | "completed" | "cancelled";
    currency: string | null;
    createdByUserId: number | null;
    paidByUserId?: number | null;
    paidByName?: string | null;
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
    amountCents: number;
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
    paymentRef: string | null;
  }>;
  summary: {
    transferCount: number;
    paidTransfersCount: number;
    totalAmount: number;
    outstandingAmount: number;
  };
};

type CrewParticipant = {
  id: number;
  name: string;
  userId: number | null;
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
  return `€${safeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatRoundDate(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function getScopeLabel(scopeType: "everyone" | "selected", selectedCount?: number | null) {
  if (scopeType === "everyone") return "Everyone";
  if ((selectedCount ?? 0) <= 0) return "Selected people";
  return `${selectedCount} selected`;
}

function getRoundTypeLabel(roundType: "balance_settlement" | "direct_split") {
  return roundType === "direct_split" ? "Settle now" : "Settle up";
}

export function SettlementPanel({ settlementId, createMode }: { settlementId?: string; createMode?: "direct-split" | "balance-settlement" }) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const { replacePanel } = usePanel();
  const [draftMode, setDraftMode] = useState<"direct-split" | "balance-settlement">(createMode ?? "direct-split");
  const [splitTitle, setSplitTitle] = useState("");
  const [splitAmount, setSplitAmount] = useState("");
  const [paidByParticipantId, setPaidByParticipantId] = useState<number | null>(null);
  const [splitWithParticipantIds, setSplitWithParticipantIds] = useState<number[]>([]);
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = (crewQuery.data?.participants ?? []) as CrewParticipant[];
  const expenses = expensesQuery.data ?? [];
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const selectableParticipants = useMemo(
    () => participants.filter((participant) => participant.userId != null),
    [participants],
  );
  const participantById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const { settlements } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const canSettle = settlements.length > 0;
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);

  const roundsQueryKey = ["/api/events", eventId, "settlements"] as const;
  const roundsQuery = useQuery<SettlementRoundsResponse>({
    queryKey: roundsQueryKey,
    queryFn: async () => {
      if (!eventId) {
        return {
          activeFinalSettlementRound: null,
          activeQuickSettleRound: null,
          pastFinalSettlementRounds: [],
          pastQuickSettleRounds: [],
        };
      }
      const res = await fetch(`/api/events/${eventId}/settlements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlements");
      return res.json() as Promise<SettlementRoundsResponse>;
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const selectedRoundId = settlementId
    ?? (draftMode === "direct-split"
      ? roundsQuery.data?.activeQuickSettleRound?.id
      : roundsQuery.data?.activeFinalSettlementRound?.id)
    ?? roundsQuery.data?.activeQuickSettleRound?.id
    ?? roundsQuery.data?.activeFinalSettlementRound?.id
    ?? null;
  const detailQueryKey = ["/api/events", eventId, "settlement", selectedRoundId ?? "none"] as const;
  const detailQuery = useQuery<SettlementDetailResponse>({
    queryKey: detailQueryKey,
    queryFn: async () => {
      if (!eventId || !selectedRoundId) return { settlement: null, transfers: [], summary: { transferCount: 0, paidTransfersCount: 0, totalAmount: 0, outstandingAmount: 0 } };
      const res = await fetch(`/api/events/${eventId}/settlement/${encodeURIComponent(selectedRoundId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json() as Promise<SettlementDetailResponse>;
    },
    enabled: !!eventId && !!selectedRoundId,
    staleTime: 15_000,
    refetchInterval: eventId && selectedRoundId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const selectedSettlement = detailQuery.data?.settlement ?? null;
  const settlementTransfers = detailQuery.data?.transfers ?? [];
  const paidTransfersCount = detailQuery.data?.summary.paidTransfersCount ?? 0;
  const outstandingAmount = detailQuery.data?.summary.outstandingAmount ?? 0;
  const isSettlementComplete = selectedSettlement?.status === "completed";
  const activeFinalSettlementRound = roundsQuery.data?.activeFinalSettlementRound ?? null;
  const activeQuickSettleRound = roundsQuery.data?.activeQuickSettleRound ?? null;
  const pastFinalSettlementRounds = roundsQuery.data?.pastFinalSettlementRounds ?? [];
  const pastQuickSettleRounds = roundsQuery.data?.pastQuickSettleRounds ?? [];
  const selectedScopeNames = useMemo(
    () => (selectedSettlement?.selectedParticipantIds ?? [])
      .map((id) => participantById.get(id) ?? null)
      .filter((participant): participant is CrewParticipant => !!participant)
      .filter((participant) => (
        selectedSettlement?.roundType !== "direct_split"
          || Number(participant.userId) !== Number(selectedSettlement.paidByUserId)
      ))
      .map((participant) => participant.name)
      .filter(Boolean),
    [participantById, selectedSettlement?.paidByUserId, selectedSettlement?.roundType, selectedSettlement?.selectedParticipantIds],
  );
  const selectedScopeSummary = selectedSettlement?.scopeType === "selected"
    ? selectedScopeNames.join(", ")
    : "Everyone in the plan";
  const canStartDirectSplit = !!splitTitle.trim()
    && Number(splitAmount) > 0
    && Number.isInteger(paidByParticipantId)
    && splitWithParticipantIds.length > 0
    && !activeQuickSettleRound;
  const canStartRound = canSettle && !activeFinalSettlementRound;
  const panelMode = selectedSettlement
    ? (selectedSettlement.roundType === "direct_split" ? "direct-split" : "balance-settlement")
    : draftMode;
  const panelTitle = selectedSettlement?.title
    ?? (panelMode === "direct-split" ? "Settle now" : "Settle up");
  const panelSubtitle = selectedSettlement
    ? null
    : panelMode === "direct-split"
      ? "For one-off moments when someone paid and others should pay them back."
      : "Wrap up the shared costs from this plan when the trip or event is ending.";

  useEffect(() => {
    setDraftMode(createMode ?? "direct-split");
  }, [createMode]);

  useEffect(() => {
    if (paidByParticipantId != null) return;
    const mine = selectableParticipants.find((participant: (typeof selectableParticipants)[number]) => Number(participant.userId) === Number(user?.id));
    setPaidByParticipantId(mine?.id ?? selectableParticipants[0]?.id ?? null);
  }, [paidByParticipantId, selectableParticipants, user?.id]);

  useEffect(() => {
    if (paidByParticipantId == null) return;
    setSplitWithParticipantIds((current) => current.filter((id) => id !== paidByParticipantId));
  }, [paidByParticipantId]);

  const startManualSettlement = useMutation({
    mutationFn: async ({
      scopeType,
      selectedIds,
    }: {
      scopeType: "everyone" | "selected";
      selectedIds: number[] | null;
    }) => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scopeType,
          selectedParticipantIds: selectedIds,
        }),
      });
      const body = await res.json().catch(() => ({} as { message?: string; code?: string; latest?: SettlementDetailResponse }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to start settlement") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as { latest: SettlementDetailResponse };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: roundsQueryKey });
      if (result.latest?.settlement?.id) {
        queryClient.setQueryData(detailQueryKey, result.latest);
        replacePanel({ type: "settlement", settlementId: result.latest.settlement.id });
      }
      toastSuccess("Settle up started");
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_creator_can_start_settlement") {
        toastError("Only the plan creator can start settle up.");
        return;
      }
      if (err.code === "active_settlement_exists") {
        toastError("Finish the active settle up before starting a new one.");
        return;
      }
      if (err.code === "nothing_to_settle") {
        toastError("No settle up is needed for this shared-expense scope yet.");
        return;
      }
      toastError(err.message || "Couldn’t start settle up.");
    },
  });

  const startDirectSplit = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/split-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: splitTitle.trim(),
          amount: Number(splitAmount),
          paidByParticipantId,
          splitWithParticipantIds,
        }),
      });
      const body = await res.json().catch(() => ({} as { message?: string; code?: string; latest?: SettlementDetailResponse }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to create payback") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as { latest: SettlementDetailResponse };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: roundsQueryKey });
      if (result.latest?.settlement?.id) {
        replacePanel({ type: "settlement", settlementId: result.latest.settlement.id });
      }
      setSplitTitle("");
      setSplitAmount("");
      setSplitWithParticipantIds([]);
      toastSuccess("Payback created");
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "active_settlement_exists") {
        toastError("Finish the active payback before starting a new one.");
        return;
      }
      if (err.code === "invalid_direct_split") {
        toastError("Choose a payer, amount, and at least one person to split with.");
        return;
      }
      toastError(err.message || "Couldn’t create the payback.");
    },
  });

  const markTransferPaid = useMutation({
    mutationFn: async ({ settlementId: activeSettlementId, transferId }: { settlementId: string; transferId: string }) => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/${activeSettlementId}/transfers/${transferId}/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({} as { message?: string; code?: string }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to mark transfer paid") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as { transferId: string; paidAt: string | null };
    },
    onMutate: async ({ transferId }) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      const previous = queryClient.getQueryData<SettlementDetailResponse>(detailQueryKey);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<SettlementDetailResponse>(detailQueryKey, (old) => {
        if (!old) return old;
        const transfers = old.transfers.map((transfer) => (
          transfer.id === transferId ? { ...transfer, paidAt: nowIso } : transfer
        ));
        const paidCount = transfers.filter((transfer) => !!transfer.paidAt).length;
        return {
          ...old,
          settlement: old.settlement ? {
            ...old.settlement,
            status: paidCount >= transfers.length && transfers.length > 0 ? "completed" : old.settlement.status,
          } : old.settlement,
          summary: {
            ...old.summary,
            paidTransfersCount: paidCount,
            outstandingAmount: transfers.reduce((sum, transfer) => sum + (transfer.paidAt ? 0 : Number(transfer.amount || 0)), 0),
          },
          transfers,
        };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(detailQueryKey, context.previous);
      const err = error as Error & { code?: string };
      if (err.code === "not_transfer_participant") {
        toastError("Only the payer or receiver can mark this as paid.");
        return;
      }
      toastError(err.message || "Couldn’t mark transfer as paid.");
    },
    onSuccess: () => {
      toastSuccess("Payment marked as paid");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: detailQueryKey });
      await queryClient.invalidateQueries({ queryKey: roundsQueryKey });
    },
  });

  return (
    <PanelShell>
      <PanelHeader
        label="Money"
        title={panelTitle}
        meta={selectedSettlement ? (
          <>
            <span>
              {getRoundTypeLabel(selectedSettlement.roundType)}
              {" · "}
              {selectedSettlement.status === "active" ? "In progress" : selectedSettlement.status === "completed" ? "Completed" : "Cancelled"}
              {" · "}
              {getScopeLabel(selectedSettlement.scopeType, selectedSettlement.selectedParticipantIds?.length ?? null)}
            </span>
            <span>
              Created {selectedSettlement.createdAt ? new Date(selectedSettlement.createdAt).toLocaleString() : "recently"}
              {selectedSettlement.completedAt ? ` · Completed ${new Date(selectedSettlement.completedAt).toLocaleString()}` : ""}
            </span>
          </>
        ) : (
          <span>{panelSubtitle ?? (activeQuickSettleRound || activeFinalSettlementRound ? "Money activity in progress" : "Add group expenses, pay someone back, or settle up later")}</span>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect money rounds.
          </div>
        ) : roundsQuery.isLoading ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {panelMode === "direct-split" ? "Loading paybacks…" : "Loading settle up…"}
          </div>
        ) : roundsQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            <p>{panelMode === "direct-split" ? "Couldn’t load paybacks." : "Couldn’t load settle up."}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => void roundsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {selectedSettlement ? (
              <>
                <PanelSection title={selectedSettlement.roundType === "direct_split" ? "Payback details" : "Settle-up details"} variant="workflow">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2">
                          <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {selectedSettlement.status}
                          </span>
                          <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                            {getRoundTypeLabel(selectedSettlement.roundType)}
                          </span>
                          <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                            {selectedSettlement.roundType === "direct_split"
                              ? (selectedSettlement.paidByName ? `Paid by ${selectedSettlement.paidByName}` : "Payback")
                              : getScopeLabel(selectedSettlement.scopeType, selectedSettlement.selectedParticipantIds?.length ?? null)}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                          {selectedSettlement.roundType === "direct_split"
                            ? `Split with ${selectedScopeSummary}`
                            : selectedScopeSummary}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Remaining</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">
                          {formatCurrency(outstandingAmount, selectedSettlement.currency || currency)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{formatRoundDate(selectedSettlement.createdAt)}</p>
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Transfers</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{settlementTransfers.length}</p>
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Paid</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{paidTransfersCount}</p>
                      </div>
                      <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Remaining</p>
                        <p className="mt-1 text-sm font-medium text-foreground">{Math.max(0, settlementTransfers.length - paidTransfersCount)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted/70 dark:bg-white/8">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${selectedSettlement && settlementTransfers.length > 0 ? Math.round((paidTransfersCount / settlementTransfers.length) * 100) : 0}%` }}
                        />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {isSettlementComplete
                          ? "All transfers in this round are paid."
                          : `${formatCurrency(outstandingAmount, selectedSettlement.currency || currency)} still left to settle`}
                      </p>
                    </div>
                  </div>
                </PanelSection>

                <PanelSection title="Transfers" variant="workflow">
                  <div className="space-y-2">
                    {settlementTransfers.map((transfer) => {
                      const paid = !!transfer.paidAt;
                      const currentUserId = Number(user?.id ?? 0);
                      const canMarkPaid = selectedSettlement.status === "active"
                        && currentUserId > 0
                        && (currentUserId === transfer.fromUserId || currentUserId === transfer.toUserId);
                      return (
                        <div key={`settlement-transfer-${transfer.id}`} className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-foreground">
                                <span className="font-medium">{transfer.fromName || "Someone"}</span>
                                <span className="text-muted-foreground"> pays </span>
                                <span className="font-medium">{transfer.toName || "Someone"}</span>
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {paid ? `Paid ${formatRoundDate(transfer.paidAt)}` : "Pending payment"}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-foreground">
                              {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)}
                            </span>
                          </div>
                          <div className="mt-2">
                            {paid ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Paid
                              </span>
                            ) : canMarkPaid ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => markTransferPaid.mutate({ settlementId: transfer.settlementId, transferId: transfer.id })}
                                disabled={markTransferPaid.isPending || isSettlementComplete}
                              >
                                Mark as paid
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {selectedSettlement.status === "active" ? "Only payer or receiver can mark this as paid." : "Completed rounds are read-only."}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </PanelSection>
              </>
            ) : null}

            {!selectedSettlement ? (
              panelMode === "direct-split" ? (
                <>
                  <PanelSection title="Settle now" variant="workflow">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        For expenses that were settled immediately — the involved people pay back right away.
                      </p>

                      {activeQuickSettleRound ? (
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{activeQuickSettleRound.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {activeQuickSettleRound.paidTransfersCount}/{activeQuickSettleRound.transferCount} paid · {formatCurrency(activeQuickSettleRound.outstandingAmount, activeQuickSettleRound.currency || currency)} left
                              </p>
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={() => replacePanel({ type: "settlement", settlementId: activeQuickSettleRound.id })}>
                              Open
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 p-3">
                          <p className="text-sm font-medium text-foreground">No settle-now expenses yet.</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add an expense with “Settle now” when people should pay back right away.
                          </p>
                        </div>
                      )}

                      {!activeQuickSettleRound ? (
                        <div className="space-y-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 p-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">What was paid?</label>
                              <Input value={splitTitle} onChange={(event) => setSplitTitle(event.target.value)} placeholder="Uber, pizza, groceries…" />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">Amount</label>
                              <Input value={splitAmount} onChange={(event) => setSplitAmount(event.target.value)} inputMode="decimal" placeholder="24.00" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Paid by</label>
                            <select
                              value={paidByParticipantId ?? ""}
                              onChange={(event) => setPaidByParticipantId(Number(event.target.value))}
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              {selectableParticipants.map((participant) => (
                                <option key={`payer-${participant.id}`} value={participant.id}>{participant.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-foreground">Split with</p>
                                <p className="mt-1 text-xs text-muted-foreground">Choose who should pay this person back now.</p>
                              </div>
                              <span className="rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                                {splitWithParticipantIds.length} selected
                              </span>
                            </div>
                            <div className="mt-3 space-y-2">
                              {selectableParticipants
                                .filter((participant) => participant.id !== paidByParticipantId)
                                .map((participant: (typeof selectableParticipants)[number]) => {
                                  const checked = splitWithParticipantIds.includes(participant.id);
                                  return (
                                    <label key={`split-recipient-${participant.id}`} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/70 px-3 py-2.5">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(nextChecked) => {
                                          setSplitWithParticipantIds((current) => nextChecked
                                            ? [...current, participant.id]
                                            : current.filter((id) => id !== participant.id));
                                        }}
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{participant.name}</p>
                                        <p className="text-xs text-muted-foreground">Will owe an equal share</p>
                                      </div>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3">
                            <p className="text-sm font-medium text-foreground">Missing an expense?</p>
                              <p className="mt-1 text-xs text-muted-foreground">Need this in the group costs too? Add the expense first, then come back and create the payback.</p>
                            <Button type="button" variant="ghost" className="mt-1 h-auto p-0 text-sm hover:bg-transparent" onClick={() => replacePanel({ type: "add-expense", source: "overview" })}>
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add expense first
                            </Button>
                          </div>
                          <Button
                            type="button"
                            onClick={() => void startDirectSplit.mutateAsync()}
                            disabled={startDirectSplit.isPending || !canStartDirectSplit}
                          >
                            {startDirectSplit.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Receipt className="mr-1.5 h-4 w-4" />}
                            Settle now
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-3 text-sm text-muted-foreground">
                          Finish the active settle-now request before starting a new one.
                        </div>
                      )}
                    </div>
                  </PanelSection>

                  <PanelSection title="Recent settle-now expenses" variant="list">
                    {pastQuickSettleRounds.length > 0 ? (
                      <div className="space-y-2">
                        {pastQuickSettleRounds
                          .sort((a, b) => new Date(b.completedAt ?? b.createdAt ?? 0).getTime() - new Date(a.completedAt ?? a.createdAt ?? 0).getTime())
                          .map((round) => (
                            <button
                              key={`quick-settle-history-${round.id}`}
                              type="button"
                              onClick={() => replacePanel({ type: "settlement", settlementId: round.id })}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/70 px-3 py-2.5 text-left transition hover:bg-[hsl(var(--surface-2))]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{round.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {round.completedAt ? formatRoundDate(round.completedAt) : "Past round"} · {round.paidByName ? `Paid by ${round.paidByName}` : "Settled now"}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-foreground">
                                {formatCurrency(round.totalAmount, round.currency || currency)}
                              </span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-3 text-sm text-muted-foreground">
                        No settle-now history yet.
                      </div>
                    )}
                  </PanelSection>
                </>
              ) : (
                <>
                  <PanelSection title="Settle up" variant="workflow">
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Wrap up the shared plan costs here. Paybacks stay separate and are not included.
                      </p>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Shared total</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0), currency)}</p>
                        </div>
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Expenses</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{expenses.length}</p>
                        </div>
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3 sm:block hidden">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">People</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{participants.length}</p>
                        </div>
                      </div>

                      {activeFinalSettlementRound ? (
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground">{activeFinalSettlementRound.title}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {activeFinalSettlementRound.paidTransfersCount}/{activeFinalSettlementRound.transferCount} paid · {formatCurrency(activeFinalSettlementRound.outstandingAmount, activeFinalSettlementRound.currency || currency)} left
                              </p>
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={() => replacePanel({ type: "settlement", settlementId: activeFinalSettlementRound.id })}>
                              Open
                            </Button>
                          </div>
                        </div>
                      ) : !canSettle ? (
                        <div className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 p-3">
                          <p className="text-sm font-medium text-foreground">No settle up yet.</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add shared expenses first. Settle up appears when the plan has balances to resolve.
                          </p>
                        </div>
                      ) : null}

                      {!activeFinalSettlementRound ? (
                        isCreator ? (
                          <Button
                            type="button"
                            onClick={() => void startManualSettlement.mutateAsync({
                              scopeType: "everyone",
                              selectedIds: null,
                            })}
                            disabled={startManualSettlement.isPending || !canStartRound}
                          >
                            {startManualSettlement.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scale className="mr-1.5 h-4 w-4" />}
                            Start settle up
                          </Button>
                        ) : (
                          <div className="rounded-xl border border-dashed border-border/70 bg-card/60 px-3 py-3 text-sm text-muted-foreground">
                            Only the plan creator can start settle up. You can still add expenses and open existing rounds.
                          </div>
                        )
                      ) : null}
                    </div>
                  </PanelSection>

                  <PanelSection title="Past settle-ups" variant="list">
                    {pastFinalSettlementRounds.length > 0 ? (
                      <div className="space-y-2">
                        {pastFinalSettlementRounds
                          .sort((a, b) => new Date(b.completedAt ?? b.createdAt ?? 0).getTime() - new Date(a.completedAt ?? a.createdAt ?? 0).getTime())
                          .map((round) => (
                            <button
                              key={`final-settlement-history-${round.id}`}
                              type="button"
                              onClick={() => replacePanel({ type: "settlement", settlementId: round.id })}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-2))]/70 px-3 py-2.5 text-left transition hover:bg-[hsl(var(--surface-2))]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{round.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {round.completedAt ? formatRoundDate(round.completedAt) : "Past round"} · {getScopeLabel(round.scopeType, round.selectedParticipantIds?.length ?? null)}
                                </p>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-foreground">
                                {formatCurrency(round.totalAmount, round.currency || currency)}
                              </span>
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-3 text-sm text-muted-foreground">
                        No settle-ups in history yet.
                      </div>
                    )}
                  </PanelSection>
                </>
              )
            ) : null}
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default SettlementPanel;
