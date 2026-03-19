// Interactive chat expense system message card (Splann-O).
import { MoreHorizontal, ReceiptText } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExpenseWithParticipant } from "@shared/schema";
import { getExpenseLockState } from "@shared/lib/expense-lock";
import { useCheckoutSettlementTransfer } from "@/hooks/use-bbq-data";
import { useExpenses } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { useAppToast } from "@/hooks/use-app-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ExpenseAction = "added" | "updated" | "deleted";

export type ExpenseFallbackSnapshot = {
  item: string;
  amount: number;
  currency: string;
  paidBy: string;
};

export type ExpenseMessageMetadata = ExpenseFallbackSnapshot & {
  action: ExpenseAction;
  expenseId: number;
  actorName?: string;
  resolutionMode?: "later" | "now" | string;
  linkedSettlementRoundId?: string;
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
    amount: number;
    currency: string;
    paidAt: string | null;
    paidByUserId: number | null;
  }>;
};

function parseIncludedUserIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
  } catch {
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((entry) => entry.replace(/^"+|"+$/g, "").trim())
        .filter(Boolean);
    }
  }
  return [];
}

function formatAmount(amount: number, currency: string): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const cur = String(currency ?? "").trim();
  if (/^[A-Z]{3}$/.test(cur)) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(safeAmount);
    } catch {
      // continue with prefix formatting
    }
  }
  const prefix = cur || "€";
  return `${prefix}${safeAmount.toFixed(2)}`;
}

function compactItemLabel(item: string): string {
  const value = item.trim();
  return value || "Expense";
}

function actionSummary(action: ExpenseAction, actor: string): string {
  const safeActor = actor.trim() || "Someone";
  if (action === "added") return `${safeActor} added an expense`;
  if (action === "updated") return `${safeActor} updated an expense`;
  return `${safeActor} deleted an expense`;
}

export function ExpenseCard({
  eventId,
  expenseId,
  action,
  fallback,
  className,
  optimisticDeleted = false,
  onEdit,
  onOpenEdit,
  onOpenDetail,
  onDelete,
  onCopyAmount,
  actorName,
  resolutionMode,
  settlementId,
}: {
  eventId: number;
  expenseId: number;
  action: ExpenseAction;
  fallback: ExpenseFallbackSnapshot;
  className?: string;
  optimisticDeleted?: boolean;
  onEdit?: ((expenseId: number) => void) | undefined;
  onOpenEdit?: ((expenseId: number) => void) | undefined;
  onOpenDetail?: ((expenseId: number) => void) | undefined;
  onDelete?: ((expenseId: number) => void) | undefined;
  onCopyAmount?: ((expense: { amount: number; currency: string }) => void) | undefined;
  actorName?: string | undefined;
  resolutionMode?: "later" | "now" | string | undefined;
  settlementId?: string | undefined;
}) {
  const { user } = useAuth();
  const { toastError } = useAppToast();
  const expensesQuery = useExpenses(eventId);
  const checkoutTransfer = useCheckoutSettlementTransfer();
  const liveExpense = useMemo(() => {
    const expenses = (expensesQuery.data ?? []) as ExpenseWithParticipant[];
    return expenses.find((expense) => Number(expense.id) === expenseId) ?? null;
  }, [expensesQuery.data, expenseId]);
  const resolvedSettlementId = String(
    (liveExpense as unknown as { linkedSettlementRoundId?: string | null })?.linkedSettlementRoundId
    ?? settlementId
    ?? "",
  ).trim();
  const isSettleNowExpense = String(
    (liveExpense as unknown as { resolutionMode?: string | null })?.resolutionMode
    ?? resolutionMode
    ?? "later",
  ).trim().toLowerCase() === "now" && !!resolvedSettlementId;

  const settlementQueryKey = useMemo(
    () => ["/api/events", eventId, "settlement", resolvedSettlementId],
    [eventId, resolvedSettlementId],
  );
  const settlementQuery = useQuery<SettlementResponse>({
    queryKey: settlementQueryKey,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/settlement/${encodeURIComponent(resolvedSettlementId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load settlement");
      return res.json();
    },
    enabled: isSettleNowExpense,
    staleTime: 20_000,
  });

  const resolved = useMemo(() => {
    if (liveExpense && !optimisticDeleted) {
      const splitCount = parseIncludedUserIds((liveExpense as unknown as { includedUserIds?: unknown }).includedUserIds).length;
      return {
        item: liveExpense.item || fallback.item || "Expense",
        amount: Number(liveExpense.amount),
        currency: fallback.currency || "€",
        paidBy: liveExpense.participantName || fallback.paidBy || "Someone",
        splitCount,
        resolutionMode: String((liveExpense as unknown as { resolutionMode?: string | null }).resolutionMode ?? resolutionMode ?? "later").trim().toLowerCase(),
        deleted: false,
        notLoaded: false,
      };
    }
    if (action === "deleted" || optimisticDeleted) {
      return {
        item: fallback.item || "Deleted expense",
        amount: fallback.amount,
        currency: fallback.currency || "€",
        paidBy: fallback.paidBy || "Someone",
        splitCount: 0,
        resolutionMode: String(resolutionMode ?? "later").trim().toLowerCase(),
        deleted: true,
        notLoaded: false,
      };
    }
    return {
      item: fallback.item || "Expense",
      amount: fallback.amount,
      currency: fallback.currency || "€",
      paidBy: fallback.paidBy || "Someone",
      splitCount: 0,
      resolutionMode: String(resolutionMode ?? "later").trim().toLowerCase(),
      deleted: false,
      notLoaded: true,
    };
  }, [action, fallback.amount, fallback.currency, fallback.item, fallback.paidBy, liveExpense, optimisticDeleted, resolutionMode]);
  const canDeleteExpense = useMemo(() => {
    if (!liveExpense || resolved.deleted) return false;
    const lockState = getExpenseLockState({
      linkedSettlementRoundId: (liveExpense as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? null,
      settledAt: (liveExpense as { settledAt?: string | Date | null }).settledAt ?? null,
      excludedFromFinalSettlement: (liveExpense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement ?? false,
      resolutionMode: (liveExpense as { resolutionMode?: string | null }).resolutionMode ?? null,
    });
    return !lockState.locked && Number((liveExpense as { createdByUserId?: number | null }).createdByUserId ?? 0) === Number(user?.id ?? 0);
  }, [liveExpense, resolved.deleted, user?.id]);
  const canEditExpense = useMemo(() => {
    if (!liveExpense || resolved.deleted) return false;
    return !getExpenseLockState({
      linkedSettlementRoundId: (liveExpense as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? null,
      settledAt: (liveExpense as { settledAt?: string | Date | null }).settledAt ?? null,
      excludedFromFinalSettlement: (liveExpense as { excludedFromFinalSettlement?: boolean | null }).excludedFromFinalSettlement ?? false,
      resolutionMode: (liveExpense as { resolutionMode?: string | null }).resolutionMode ?? null,
    }).locked;
  }, [liveExpense, resolved.deleted]);

  const handleEdit = () => {
    if (onOpenEdit) {
      onOpenEdit(expenseId);
      return;
    }
    onEdit?.(expenseId);
  };
  const handleOpenDetail = () => {
    onOpenDetail?.(expenseId);
  };

  const displayItem = resolved.deleted ? "Deleted expense" : compactItemLabel(resolved.item);
  const formattedAmount = formatAmount(resolved.amount, resolved.currency);
  const splitChipLabel = resolved.splitCount > 0 ? `Split ${resolved.splitCount}` : "Everyone";
  const amountLine = resolved.deleted
    ? `${formattedAmount} · originally paid by ${resolved.paidBy}`
    : `${formattedAmount} · paid by ${resolved.paidBy}`;
  const settlementTransfers = settlementQuery.data?.transfers ?? [];
  const expenseSettledAt = (liveExpense as unknown as { settledAt?: string | Date | null } | null)?.settledAt ?? null;
  const settlementComplete = !!expenseSettledAt
    || settlementQuery.data?.settlement?.status === "completed"
    || (settlementTransfers.length > 0 && settlementTransfers.every((transfer) => !!transfer.paidAt));
  const settleNowCompleted = isSettleNowExpense && settlementComplete;
  const summary = isSettleNowExpense
    ? `${(actorName || resolved.paidBy || "Someone").trim() || "Someone"} added an expense`
    : actionSummary(action, actorName || resolved.paidBy);

  const handlePay = async (transferId: string) => {
    try {
      const result = await checkoutTransfer.mutateAsync({
        eventId,
        transferId,
        expenseId,
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

  useEffect(() => {
    if (!import.meta.env.DEV || !isSettleNowExpense) return;
    console.log("[settle-now:expense-card]", {
      eventId,
      expenseId,
      liveExpenseLoaded: !!liveExpense,
      expenseSettledAt,
      settlementQueryStatus: settlementQuery.status,
      settlementTransfers: settlementTransfers.length,
      settlementComplete,
      settleNowCompleted,
    });
  }, [eventId, expenseId, expenseSettledAt, isSettleNowExpense, liveExpense, settlementComplete, settlementQuery.status, settlementTransfers.length, settleNowCompleted]);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "interactive-card relative w-full max-w-[95%] rounded-2xl px-4 py-2.5 text-left",
        isSettleNowExpense
          ? settleNowCompleted
            ? "border border-emerald-500/20 bg-emerald-500/8 hover:border-emerald-500/30 hover:bg-emerald-500/12 dark:border-emerald-500/25 dark:bg-emerald-500/10"
            : "border border-primary/15 bg-[hsl(44_56%_93%)] hover:border-primary/30 hover:bg-[hsl(44_56%_91%)] dark:border-primary/25 dark:bg-primary/12"
          : "border border-border/70 bg-muted hover:border-border hover:bg-muted dark:border-neutral-700/75 dark:bg-neutral-800 dark:hover:bg-neutral-800",
        resolved.deleted && "opacity-80",
        className,
      )}
      onClick={handleOpenDetail}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpenDetail();
        }
      }}
    >
      {!isSettleNowExpense ? (
        <span className="absolute right-3 top-2.5 inline-flex h-fit items-center rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900 dark:text-neutral-300">
          {splitChipLabel}
        </span>
      ) : null}
      <div className="grid w-full grid-cols-[24px,minmax(0,1fr)] items-start gap-x-3">
        <span className={cn(
          "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground dark:text-neutral-300",
          isSettleNowExpense
            ? settleNowCompleted
              ? "border border-emerald-500/20 bg-background/85 text-emerald-700 dark:border-emerald-500/25 dark:bg-background/20 dark:text-emerald-300"
              : "border border-primary/15 bg-background/80"
            : "border border-border/60 bg-background dark:border-neutral-700/80 dark:bg-neutral-900",
        )}>
          <ReceiptText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={cn("overflow-hidden whitespace-nowrap text-[11px] font-medium tracking-wide text-muted-foreground/95 dark:text-neutral-400", !isSettleNowExpense && "pr-28")}>
            {summary}
          </p>
          <p className={cn("mt-1 text-[15px] font-medium leading-5 text-foreground", resolved.deleted && "line-through text-foreground/80")}>
            {displayItem}
          </p>
          <p
            className={cn(
              "mt-0.5 whitespace-nowrap pr-2 text-sm font-medium leading-5 text-foreground/90 dark:text-neutral-200",
              resolved.deleted && "text-foreground/75 dark:text-neutral-300/85",
            )}
          >
            <span>{amountLine}</span>
          </p>
          {settleNowCompleted ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Paid
              </span>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                Settle-now payment completed
              </p>
            </div>
          ) : null}
          {isSettleNowExpense && !resolved.deleted && !settleNowCompleted ? (
            <div className="mt-3 rounded-xl border border-border/60 bg-background/90 px-3 py-2.5 dark:border-neutral-700/80 dark:bg-neutral-900/90">
              {settlementTransfers.length > 0 ? (
                <div className="space-y-2">
                  {settlementTransfers.map((transfer) => {
                    const canPay = !transfer.paidAt && !!user && user.id === transfer.fromUserId;
                    return (
                      <div key={transfer.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{transfer.fromName || transfer.fromUserId}</span>
                          {" owes "}
                          <span className="font-medium text-foreground">{transfer.toName || transfer.toUserId}</span>
                          {" "}
                          <span className="font-semibold text-foreground">{formatAmount(transfer.amount, transfer.currency || resolved.currency)}</span>
                        </div>
                        {transfer.paidAt ? (
                          <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Paid
                          </span>
                        ) : canPay ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[11px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handlePay(transfer.id);
                            }}
                            disabled={checkoutTransfer.isPending || settlementComplete}
                          >
                            Pay
                          </Button>
                        ) : (
                          <span className="shrink-0 text-[11px] text-muted-foreground">Waiting for payment</span>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground">
                    {settlementComplete ? "This settle-now expense is fully paid." : "Payment is still outstanding."}
                  </p>
                </div>
              ) : settlementQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading payment state…</p>
              ) : (
                <p className="text-xs text-muted-foreground">Payment details unavailable.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="absolute bottom-2 right-2 shrink-0 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground/85 hover:bg-background hover:text-foreground dark:hover:bg-neutral-900 md:hidden"
                onClick={(event) => event.stopPropagation()}
                aria-label="Expense actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36" onClick={(event) => event.stopPropagation()}>
              {canEditExpense ? (
                <DropdownMenuItem onClick={handleEdit}>
                  Edit expense
                </DropdownMenuItem>
              ) : null}
              {canDeleteExpense ? (
                <DropdownMenuItem onClick={() => onDelete?.(expenseId)} className="text-destructive focus:text-destructive">
                  Delete expense
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => onCopyAmount?.({ amount: resolved.amount, currency: resolved.currency })}>
                {`Copy ${formattedAmount}`}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
