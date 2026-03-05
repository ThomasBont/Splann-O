import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { cn } from "@/lib/utils";

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

export function SettlementCard({ eventId, settlementId, currency, className }: SettlementCardProps) {
  const { user } = useAuth();
  const { toastError } = useAppToast();
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
        const nextStatus = total > 0 && paid >= total ? "settled" : (paid > 0 ? "in_progress" : old.settlement?.status ?? "proposed");
        return {
          ...old,
          settlement: old.settlement ? {
            ...old.settlement,
            status: nextStatus as "proposed" | "in_progress" | "settled",
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const transfers = settlementQuery.data?.transfers ?? [];
  const displayCurrency = settlementQuery.data?.settlement?.currency || currency;
  const totalTransfers = transfers.length;
  const paidTransfers = transfers.filter((transfer) => !!transfer.paidAt).length;
  const progressText = `${paidTransfers}/${totalTransfers} paid`;
  const progressPercent = totalTransfers > 0 ? Math.round((paidTransfers / totalTransfers) * 100) : 0;
  const isSettled = (settlementQuery.data?.settlement?.status === "settled")
    || (totalTransfers > 0 && paidTransfers >= totalTransfers);

  return (
    <div className={cn("w-full rounded-2xl border border-border/65 bg-muted/35 px-3 py-2.5 dark:border-neutral-700/70 dark:bg-neutral-800/65", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            Settle up
          </div>
          {totalTransfers > 0 ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{progressText}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isSettled
              ? "border border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border border-primary/25 bg-primary/10 text-foreground",
          )}
        >
          {isSettled ? "settled" : (settlementQuery.data?.settlement?.status ?? "proposed")}
        </span>
      </div>
      {totalTransfers > 0 ? (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-border/50">
          <div className="h-full rounded-full bg-emerald-500/80 transition-all" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
        </div>
      ) : null}

      {transfers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No transfers needed.</p>
      ) : (
        <div className="space-y-1.5">
          {transfers.map((transfer) => {
            const paid = !!transfer.paidAt;
            const canMarkPaid = !!user && (user.id === transfer.fromUserId || user.id === transfer.toUserId);
            return (
              <div key={transfer.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-xs dark:bg-neutral-900/35">
                <p className="min-w-0 truncate text-muted-foreground">
                  <span className="font-medium text-foreground">{transfer.fromName || transfer.fromUserId}</span>
                  {" \u2192 "}
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
                    onClick={() => markPaid.mutate(transfer.id)}
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
    </div>
  );
}

export default SettlementCard;
