// Interactive chat expense system message card (Splann-O).
import { MoreHorizontal, ReceiptText } from "lucide-react";
import { useMemo } from "react";
import type { ExpenseWithParticipant } from "@shared/schema";
import { useExpenses } from "@/hooks/use-expenses";
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

function actionLabel(action: ExpenseAction): string {
  if (action === "added") return "Added";
  if (action === "updated") return "Updated";
  return "Deleted";
}

function compactItemLabel(item: string): string {
  const value = item.trim();
  if (!value) return "Expense";
  const MAX = 28;
  if (value.length <= MAX) return value;
  return `${value.slice(0, MAX - 1).trimEnd()}…`;
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
  onDelete,
  onCopyAmount,
}: {
  eventId: number;
  expenseId: number;
  action: ExpenseAction;
  fallback: ExpenseFallbackSnapshot;
  className?: string;
  optimisticDeleted?: boolean;
  onEdit?: ((expenseId: number) => void) | undefined;
  onOpenEdit?: ((expenseId: number) => void) | undefined;
  onDelete?: ((expenseId: number) => void) | undefined;
  onCopyAmount?: ((expense: { amount: number; currency: string }) => void) | undefined;
}) {
  const expensesQuery = useExpenses(eventId);
  const liveExpense = useMemo(() => {
    const expenses = (expensesQuery.data ?? []) as ExpenseWithParticipant[];
    return expenses.find((expense) => Number(expense.id) === expenseId) ?? null;
  }, [expensesQuery.data, expenseId]);

  const resolved = useMemo(() => {
    if (liveExpense && !optimisticDeleted) {
      const splitCount = parseIncludedUserIds((liveExpense as unknown as { includedUserIds?: unknown }).includedUserIds).length;
      return {
        item: liveExpense.item || fallback.item || "Expense",
        amount: Number(liveExpense.amount),
        currency: fallback.currency || "€",
        paidBy: liveExpense.participantName || fallback.paidBy || "Someone",
        splitCount,
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
      deleted: false,
      notLoaded: true,
    };
  }, [action, fallback.amount, fallback.currency, fallback.item, fallback.paidBy, liveExpense, optimisticDeleted]);

  const handleEdit = () => {
    if (onOpenEdit) {
      onOpenEdit(expenseId);
      return;
    }
    onEdit?.(expenseId);
  };

  const displayItem = resolved.deleted ? "Deleted expense" : compactItemLabel(resolved.item);
  const formattedAmount = formatAmount(resolved.amount, resolved.currency);
  const splitLabel = resolved.splitCount > 0 ? `split ${resolved.splitCount}` : "split everyone";
  const subtitle = resolved.deleted
    ? `${formattedAmount} · originally paid by ${resolved.paidBy} · ${splitLabel}`
    : `${formattedAmount} · paid by ${resolved.paidBy} · ${splitLabel}`;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group w-full max-w-[70%] rounded-2xl border border-border/70 bg-card/60 px-4 py-2 text-left transition hover:border-border/80 hover:bg-card/75 dark:border-neutral-700/70 dark:bg-neutral-800/65 dark:hover:bg-neutral-800/80",
        resolved.deleted && "opacity-80",
        className,
      )}
      onClick={handleEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleEdit();
        }
      }}
    >
      <div className="grid w-full grid-cols-[20px,1fr,28px] items-start gap-x-2">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card/70 text-muted-foreground dark:border-neutral-700/80 dark:bg-neutral-900/40">
          <ReceiptText className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <span className={cn("min-w-0 truncate text-sm font-semibold text-foreground", resolved.deleted && "line-through text-foreground/80")}>
              {displayItem}
            </span>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
            <p className={cn("min-w-0 truncate text-xs leading-4 text-muted-foreground", resolved.deleted && "text-muted-foreground/90")}>
              {subtitle}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide",
                resolved.deleted
                  ? "border-border/60 bg-card/60 text-muted-foreground"
                  : "border-primary/30 bg-primary/15 text-foreground",
              )}
            >
              {actionLabel(action)}
            </span>
          </div>
          {resolved.notLoaded ? (
            <p className={cn("truncate text-[10px] leading-4 text-muted-foreground/70", resolved.deleted && "text-muted-foreground/70")}>
              · Not loaded
            </p>
          ) : null}
          <div className="mt-1 hidden items-center gap-1.5 md:flex md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
            <button
              type="button"
              className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                window.dispatchEvent(new CustomEvent("splanno:open-expenses", {
                  detail: { eventId, initialView: "overview" },
                }));
              }}
            >
              View
            </button>
            <button
              type="button"
              className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                handleEdit();
              }}
            >
              Edit
            </button>
          </div>
        </div>
        <div className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground/80 hover:text-foreground md:hidden"
                onClick={(event) => event.stopPropagation()}
                aria-label="Expense actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={handleEdit}>
                Edit expense
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(expenseId)} className="text-destructive focus:text-destructive">
                Delete expense
              </DropdownMenuItem>
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
