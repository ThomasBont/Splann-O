import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/lib/utils";
import { usePanel } from "@/state/panel";

type SettlementCardProps = {
  eventId: number;
  settlementId: string;
  currency: string;
  className?: string;
};

type SettlementResponse = {
  settlement: {
    id: string;
    eventId: number;
    title?: string;
    roundType?: "balance_settlement" | "direct_split";
    status: "active" | "completed" | "cancelled";
    currency: string | null;
    createdAt: string | null;
    completedAt?: string | null;
    paidByName?: string | null;
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

function formatMoney(amount: number, currency: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const code = String(currency || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(safe);
    } catch {
      // continue
    }
  }
  return `${currency || "€"}${safe.toFixed(2)}`;
}

function getRoundTypeLabel(roundType?: "balance_settlement" | "direct_split" | null) {
  return roundType === "direct_split" ? "Payback" : "Settle up";
}

export function SettlementCard({ eventId, settlementId, currency, className }: SettlementCardProps) {
  const { user } = useAuth();
  const { toastError } = useAppToast();
  const { replacePanel } = usePanel();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["/api/events", eventId, "settlement", settlementId], [eventId, settlementId]);

  const settlementQuery = useQuery<SettlementResponse>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/settlement/${encodeURIComponent(settlementId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json();
    },
    enabled: !!eventId && !!settlementId,
    staleTime: 20_000,
  });

  const markPaid = useMutation({
    mutationFn: async (transferId: string) => {
      const res = await fetch(`/api/events/${eventId}/settlement/${settlementId}/transfers/${transferId}/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { code?: string; message?: string }));
        const error = new Error(body.message || "Failed to mark transfer as paid") as Error & { code?: string };
        error.code = body.code;
        throw error;
      }
      return res.json() as Promise<{ transferId: string; paidAt: string | null }>;
    },
    onMutate: async (transferId: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<SettlementResponse>(queryKey);
      const paidAt = new Date().toISOString();
      queryClient.setQueryData<SettlementResponse>(queryKey, (old) => {
        if (!old) return old;
        const transfers = old.transfers.map((transfer) => (
          transfer.id === transferId
            ? { ...transfer, paidAt, paidByUserId: transfer.paidByUserId ?? 0 }
            : transfer
        ));
        const total = transfers.length;
        const paid = transfers.filter((transfer) => !!transfer.paidAt).length;
        const nextStatus = total > 0 && paid >= total ? "completed" : (old.settlement?.status ?? "active");
        return {
          ...old,
          settlement: old.settlement ? {
            ...old.settlement,
            status: nextStatus as "active" | "completed" | "cancelled",
          } : old.settlement,
          transfers,
        };
      });
      return { previous };
    },
    onError: (error, _transferId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      const err = error as Error & { code?: string };
      if (err.code === "not_transfer_participant") {
        toastError("Only the payer or receiver can mark this as paid.");
        return;
      }
      toastError(err.message || "Couldn’t mark transfer as paid.");
    },
  });

  const transfers = settlementQuery.data?.transfers ?? [];
  const displayCurrency = settlementQuery.data?.settlement?.currency || currency;
  const totalTransfers = transfers.length;
  const paidTransfers = transfers.filter((transfer) => !!transfer.paidAt).length;
  const progressText = `${paidTransfers}/${totalTransfers} paid`;
  const progressPercent = totalTransfers > 0 ? Math.round((paidTransfers / totalTransfers) * 100) : 0;
  const isSettled = (settlementQuery.data?.settlement?.status === "completed")
    || (totalTransfers > 0 && paidTransfers >= totalTransfers);
  const roundType = settlementQuery.data?.settlement?.roundType ?? "balance_settlement";
  const paidByName = settlementQuery.data?.settlement?.paidByName ?? null;
  const roundTitle = settlementQuery.data?.settlement?.title?.trim() || (roundType === "direct_split" ? "Payback" : "Settle up");

  const orderedTransfers = useMemo(() => {
    return [...transfers].sort((a, b) => {
      const aPaid = !!a.paidAt;
      const bPaid = !!b.paidAt;
      if (aPaid !== bPaid) return aPaid ? 1 : -1;
      return b.amount - a.amount;
    });
  }, [transfers]);

  const [expanded, setExpanded] = useState(false);
  const openSettlementPanel = () => {
    replacePanel({ type: "settlement", settlementId });
  };

  const hasMoreThanPreview = orderedTransfers.length > 3;
  const visibleTransfers = expanded ? orderedTransfers : orderedTransfers.slice(0, 3);

  if (isSettled && !expanded) {
    return (
      <button
        type="button"
        className={cn(
          "interactive-card flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-left",
          "hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35",
          className,
        )}
        onClick={openSettlementPanel}
      >
        <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          ✅ {roundType === "direct_split" ? "Payback completed" : "Settle up completed"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-emerald-700/85 dark:text-emerald-300/85">
          View details
          <ChevronDown className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "w-full rounded-2xl border border-primary/15 bg-[hsl(44_56%_93%)] px-3 py-2.5 text-left dark:border-primary/25 dark:bg-primary/12 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        "transition hover:border-primary/30 hover:bg-[hsl(44_56%_91%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      onClick={openSettlementPanel}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openSettlementPanel();
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            {getRoundTypeLabel(roundType)}
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{roundTitle}</p>
          {totalTransfers > 0 ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {roundType === "direct_split" && paidByName ? `Paid by ${paidByName} · ` : ""}
              {progressText}
            </p>
          ) : null}
        </div>
        {isSettled ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? "Hide details" : "View details"}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : (
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
            {settlementQuery.data?.settlement?.status ?? "active"}
          </span>
        )}
      </div>

      {totalTransfers > 0 && !isSettled ? (
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
          <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
        </div>
      ) : null}

      {transfers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No transfers needed.</p>
      ) : (
        <div className="divide-y divide-border/45 rounded-lg border border-border/55 bg-background dark:bg-neutral-900">
          {visibleTransfers.map((transfer) => {
            const paid = !!transfer.paidAt;
            const canMarkPaid = !!user && (user.id === transfer.fromUserId || user.id === transfer.toUserId);
            return (
              <div key={transfer.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                <p className="min-w-0 truncate text-muted-foreground">
                  <span className="font-medium text-foreground">{transfer.fromName || transfer.fromUserId}</span>
                  {" owes "}
                  <span className="font-medium text-foreground">{transfer.toName || transfer.toUserId}</span>
                  {" "}
                  <span className="font-semibold text-foreground">{formatMoney(transfer.amount, displayCurrency)}</span>
                </p>
                {paid ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Paid
                  </span>
                ) : canMarkPaid ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={(event) => {
                      event.stopPropagation();
                      markPaid.mutate(transfer.id);
                    }}
                    disabled={markPaid.isPending || isSettled}
                  >
                    {isSettled ? "Done" : "Mark paid"}
                  </Button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Only payer/receiver</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isSettled && hasMoreThanPreview ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? "Show less" : "View all"}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default SettlementCard;
