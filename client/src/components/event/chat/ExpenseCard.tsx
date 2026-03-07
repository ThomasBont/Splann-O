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
  const handleOpenDetail = () => {
    onOpenDetail?.(expenseId);
  };

  const displayItem = resolved.deleted ? "Deleted expense" : compactItemLabel(resolved.item);
  const formattedAmount = formatAmount(resolved.amount, resolved.currency);
  const splitChipLabel = resolved.splitCount > 0 ? `Split ${resolved.splitCount}` : "Everyone";
  const summary = actionSummary(action, resolved.paidBy);
  const amountLine = resolved.deleted
    ? `${formattedAmount} · originally paid by ${resolved.paidBy}`
    : `${formattedAmount} · paid by ${resolved.paidBy}`;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "interactive-card relative w-full max-w-[95%] rounded-2xl border border-border/65 bg-muted/45 px-4 py-2.5 text-left hover:border-border hover:bg-muted/55 dark:border-neutral-700/75 dark:bg-neutral-800/78 dark:hover:bg-neutral-800/88",
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
      <span className="absolute right-3 top-2.5 inline-flex h-fit items-center rounded-full border border-border/70 bg-background/75 px-2 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm dark:border-neutral-700/80 dark:bg-neutral-900/60 dark:text-neutral-300">
        {splitChipLabel}
      </span>
      <div className="grid w-full grid-cols-[24px,minmax(0,1fr)] items-start gap-x-3">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/65 text-muted-foreground dark:border-neutral-700/80 dark:bg-neutral-900/45 dark:text-neutral-300">
          <ReceiptText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="overflow-hidden whitespace-nowrap pr-24 text-[11px] font-medium tracking-wide text-muted-foreground/95 dark:text-neutral-400">
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
          {resolved.notLoaded ? (
            <p className={cn("truncate text-[10px] leading-4 text-muted-foreground/75 dark:text-neutral-500", resolved.deleted && "text-muted-foreground/75")}>
              · Not loaded
            </p>
          ) : null}
        </div>
        <div className="absolute bottom-2 right-2 shrink-0 md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground/85 hover:bg-background/70 hover:text-foreground dark:hover:bg-neutral-900/60 md:hidden"
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
