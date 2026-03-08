import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { computeSplit } from "@/lib/split/calc";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";

type SettlementResponse = {
  settlement: {
    id: string;
    eventId: number;
    status: "proposed" | "in_progress" | "settled";
    source: "auto" | "manual";
    currency: string | null;
    createdAt: string | null;
    settledAt?: string | null;
  } | null;
  transfers: Array<{
    id: string;
    settlementId: string;
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

export function SettlementPanel({ settlementId }: { settlementId?: string }) {
  const eventId = useActiveEventId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toastError, toastSuccess } = useAppToast();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const expenses = expensesQuery.data ?? [];
  const currency = typeof plan?.currency === "string" ? plan.currency : "EUR";
  const splitExpenses = useMemo(
    () => expenses.map((expense) => ({ ...expense, amount: Number(expense.amount || 0) })),
    [expenses],
  );
  const { balances } = useMemo(
    () => computeSplit(participants, splitExpenses, [], false),
    [participants, splitExpenses],
  );
  const canSettle = useMemo(() => balances.some((balance) => Math.abs(balance.balance) > 0.01), [balances]);
  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const settlementQueryKey = ["/api/events", eventId, "settlement", settlementId || "latest"] as const;

  const latestSettlementQuery = useQuery<SettlementResponse>({
    queryKey: settlementQueryKey,
    queryFn: async () => {
      if (!eventId) return { settlement: null, transfers: [] };
      const endpoint = settlementId
        ? `/api/events/${eventId}/settlement/${encodeURIComponent(settlementId)}`
        : `/api/events/${eventId}/settlement/latest`;
      const res = await fetch(endpoint, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json() as Promise<SettlementResponse>;
    },
    enabled: !!eventId,
    staleTime: 15_000,
    refetchInterval: eventId ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const latestSettlement = latestSettlementQuery.data?.settlement ?? null;
  const settlementTransfers = latestSettlementQuery.data?.transfers ?? [];
  const paidTransfersCount = settlementTransfers.filter((transfer) => !!transfer.paidAt).length;
  const unpaidTransfers = settlementTransfers.filter((transfer) => !transfer.paidAt);
  const outstandingAmount = unpaidTransfers.reduce((sum, transfer) => sum + Number(transfer.amount || 0), 0);
  const isSettlementComplete = settlementTransfers.length > 0
    && (latestSettlement?.status === "settled" || paidTransfersCount >= settlementTransfers.length);

  const startManualSettlement = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/manual`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({} as { message?: string; code?: string }));
      if (!res.ok) {
        const error = new Error(body.message || "Failed to start settlement") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return body as { latest: SettlementResponse };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(settlementQueryKey, result.latest ?? { settlement: null, transfers: [] });
      toastSuccess("Settlement started");
    },
    onError: (error) => {
      const err = error as Error & { code?: string };
      if (err.code === "only_creator_can_start_settlement") {
        toastError("Only the plan creator can start settlement.");
        return;
      }
      toastError(err.message || "Couldn’t start settlement.");
    },
  });

  const markTransferPaid = useMutation({
    mutationFn: async ({ settlementId, transferId }: { settlementId: string; transferId: string }) => {
      if (!eventId) throw new Error("Event not found");
      const res = await fetch(`/api/events/${eventId}/settlement/${settlementId}/transfers/${transferId}/mark-paid`, {
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
      await queryClient.cancelQueries({ queryKey: settlementQueryKey });
      const previous = queryClient.getQueryData<SettlementResponse>(settlementQueryKey);
      const nowIso = new Date().toISOString();
      queryClient.setQueryData<SettlementResponse>(settlementQueryKey, (old) => {
        if (!old) return old;
        const nextTransfers = old.transfers.map((transfer) => (
          transfer.id === transferId ? { ...transfer, paidAt: nowIso } : transfer
        ));
        const total = nextTransfers.length;
        const paid = nextTransfers.filter((transfer) => !!transfer.paidAt).length;
        return {
          ...old,
          settlement: old.settlement ? {
            ...old.settlement,
            status: total > 0 && paid >= total ? "settled" : (paid > 0 ? "in_progress" : old.settlement.status),
          } : old.settlement,
          transfers: nextTransfers,
        };
      });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(settlementQueryKey, context.previous);
      const err = error as Error & { code?: string };
      if (err.code === "not_transfer_participant") {
        toastError("Only the payer or receiver can mark this as paid.");
        return;
      }
      toastError(err.message || "Couldn’t mark transfer as paid.");
    },
    onSuccess: () => {
      toastSuccess("Transfer marked as paid");
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: settlementQueryKey });
    },
  });

  return (
    <PanelShell>
      <PanelHeader
        label="Settlement"
        title="Settle up"
        meta={(
          <span>
            {settlementTransfers.length > 0
              ? `${paidTransfersCount}/${settlementTransfers.length} payments marked paid`
              : latestSettlement
                ? "Settlement in progress"
                : canSettle
                  ? "Ready to start settlement"
                  : "Nothing to settle yet"}
          </span>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect settlement.
          </div>
        ) : latestSettlementQuery.isLoading ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading settlement…
          </div>
        ) : latestSettlementQuery.isError ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Couldn’t load settlement.
          </div>
        ) : settlementTransfers.length === 0 ? (
          <PanelSection title="Settlement" variant="workflow">
            {isCreator ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {canSettle
                    ? "No settlement yet. Start a settlement plan based on current balances."
                    : "Nothing to settle yet. Add more shared costs before starting settlement."}
                </p>
                {canSettle ? (
                  <Button type="button" onClick={() => void startManualSettlement.mutateAsync()} disabled={startManualSettlement.isPending}>
                    {startManualSettlement.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Scale className="mr-1.5 h-4 w-4" />}
                    Start settlement plan
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {canSettle ? "Only the plan creator can start settlement." : "Nothing to settle yet."}
              </p>
            )}
          </PanelSection>
        ) : (
          <>
            <PanelSection title="Progress" variant="workflow">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {isSettlementComplete ? "All settled up 🎉" : `${formatCurrency(outstandingAmount, currency)} left to settle`}
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-muted/70 dark:bg-white/8">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${settlementTransfers.length > 0 ? Math.round((paidTransfersCount / settlementTransfers.length) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Transfers" variant="workflow">
              <div className="space-y-2">
                {settlementTransfers.map((transfer) => {
                  const paid = !!transfer.paidAt;
                  const currentUserId = Number(user?.id ?? 0);
                  const canMarkPaid = currentUserId > 0 && (currentUserId === transfer.fromUserId || currentUserId === transfer.toUserId);
                  return (
                    <div
                      key={`settlement-transfer-${transfer.id}`}
                      className="rounded-xl border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))]/80 px-3 py-3"
                    >
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{transfer.fromName || "Someone"}</span>
                        <span className="text-muted-foreground"> pays </span>
                        <span className="font-medium">{transfer.toName || "Someone"}</span>
                        <span className="text-muted-foreground"> · {formatCurrency(Number(transfer.amount || 0), transfer.currency || currency)}</span>
                      </p>
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
                          <span className="text-xs text-muted-foreground">Only payer/receiver can mark paid</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PanelSection>
          </>
        )}
      </div>
    </PanelShell>
  );
}

export default SettlementPanel;
