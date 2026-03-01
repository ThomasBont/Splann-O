import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Receipt, Scale, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCreateExpense } from "@/hooks/use-expenses";
import { useDeleteExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/hooks/use-app-toast";
import type { ExpenseWithParticipant } from "@shared/schema";
import type { Balance, Settlement } from "@/lib/split/calc";

type SharedCostsDrawerProps = {
  eventId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  peopleCount: number;
  totalSpentLabel: string;
  expenseCount: number;
  categories: string[];
  participants: Array<{ id: number; name: string }>;
  expenses: ExpenseWithParticipant[];
  balances: Balance[];
  settlements: Settlement[];
  formatMoney: (amount: number) => string;
};

export function SharedCostsDrawer({
  eventId,
  open,
  onOpenChange,
  planName,
  peopleCount,
  totalSpentLabel,
  expenseCount,
  categories: categoriesProp,
  participants,
  expenses,
  balances,
  settlements,
  formatMoney,
}: SharedCostsDrawerProps) {
  const { toastError, toastSuccess } = useAppToast();
  const queryClient = useQueryClient();
  const createExpense = useCreateExpense(eventId);
  const updateExpense = useUpdateExpense(eventId);
  const deleteExpense = useDeleteExpense(eventId);
  const [view, setView] = useState<"overview" | "expense-form">("overview");
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const prevOpenRef = useRef(false);
  const subtitle = `${planName} · ${peopleCount} ${peopleCount === 1 ? "person" : "people"}`;
  const categories = useMemo(() => {
    const fallback = ["Food", "Drinks", "Transport", "Accommodation", "Activities", "Other"];
    const base = categoriesProp.length > 0 ? categoriesProp : fallback;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const entry of base) {
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);
      result.push(entry);
    }
    if (!result.includes("Other")) result.push("Other");
    return result;
  }, [categoriesProp]);
  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return b.id - a.id;
      }),
    [expenses],
  );
  const editingExpense = useMemo(
    () => (editingExpenseId == null ? null : expenses.find((expense) => expense.id === editingExpenseId) ?? null),
    [editingExpenseId, expenses],
  );
  const formCategories = useMemo(() => {
    if (category && !categories.includes(category)) return [...categories, category];
    return categories;
  }, [categories, category]);

  const resetAddForm = () => {
    setEditingExpenseId(null);
    setParticipantId(participants[0] ? String(participants[0].id) : "");
    setCategory(categories[0] ?? "Other");
    setItem("");
    setAmount("");
  };

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setView("overview");
      resetAddForm();
    }
    if (!open) {
      setView("overview");
      resetAddForm();
    }
    prevOpenRef.current = open;
  }, [open, categories, participants]);

  const openAddExpenseView = () => {
    resetAddForm();
    setView("expense-form");
  };

  const openEditExpenseView = (expense: ExpenseWithParticipant) => {
    setEditingExpenseId(expense.id);
    setParticipantId(String(expense.participantId));
    setCategory(expense.category || categories[0] || "Other");
    setItem(expense.item || "");
    setAmount(String(expense.amount));
    setView("expense-form");
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !participantId || !item.trim() || !amount || Number(amount) <= 0) return;

    try {
      if (editingExpense) {
        await updateExpense.mutateAsync({
          id: editingExpense.id,
          participantId: Number(participantId),
          category,
          item: item.trim(),
          amount: Number(amount),
        });
      } else {
        await createExpense.mutateAsync({
          participantId: Number(participantId),
          category,
          item: item.trim(),
          amount,
        });
      }

      // Shared costs cards derive from expenses/expense-shares; force canonical refresh after mutation.
      await queryClient.refetchQueries({ queryKey: ['/api/barbecues', eventId, 'expenses'], exact: true });
      await queryClient.refetchQueries({ queryKey: ['/api/barbecues', eventId, 'expense-shares'], exact: true });

      toastSuccess(editingExpense ? "Expense updated" : "Expense added");
      resetAddForm();
      setView("overview");
    } catch (error) {
      toastError((error as Error).message || (editingExpense ? "Couldn’t update expense. Try again." : "Couldn’t add expense. Try again."));
    }
  };

  const handleDeleteExpense = async () => {
    if (!eventId || !editingExpense) return;
    try {
      await deleteExpense.mutateAsync(editingExpense.id);
      await queryClient.refetchQueries({ queryKey: ['/api/barbecues', eventId, 'expenses'], exact: true });
      await queryClient.refetchQueries({ queryKey: ['/api/barbecues', eventId, 'expense-shares'], exact: true });
      toastSuccess("Expense deleted");
      resetAddForm();
      setView("overview");
    } catch (error) {
      toastError((error as Error).message || "Couldn’t delete expense. Try again.");
    }
  };

  const isMutationPending =
    createExpense.isPending || updateExpense.isPending || deleteExpense.isPending;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setView("overview");
      }}
    >
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Shared costs</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">{subtitle}</SheetDescription>
            </SheetHeader>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {view === "expense-form" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setView("overview")}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" />
                    Back to costs
                  </Button>
                </div>
                <form className="space-y-4" onSubmit={handleCreateExpense}>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                      {editingExpense ? "Edit expense" : "Add expense"}
                    </h3>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="shared-cost-participant">Paid by</Label>
                        <Select value={participantId} onValueChange={setParticipantId}>
                          <SelectTrigger id="shared-cost-participant">
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                          <SelectContent>
                            {participants.map((participant) => (
                              <SelectItem key={`shared-cost-person-${participant.id}`} value={String(participant.id)}>
                                {participant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shared-cost-category">Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger id="shared-cost-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {formCategories.map((entry) => (
                              <SelectItem key={`shared-cost-category-${entry}`} value={entry}>
                                {entry}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shared-cost-item">Item</Label>
                        <Input
                          id="shared-cost-item"
                          value={item}
                          onChange={(event) => setItem(event.target.value)}
                          placeholder="What was paid?"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="shared-cost-amount">Amount</Label>
                        <Input
                          id="shared-cost-amount"
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0.01"
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </section>
                  <div className="flex items-center justify-end gap-2">
                    {editingExpense ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleDeleteExpense()}
                        disabled={isMutationPending}
                      >
                        Delete
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" onClick={() => setView("overview")} disabled={isMutationPending}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!eventId || !participantId || !item.trim() || !amount || Number(amount) <= 0 || isMutationPending}
                    >
                      {isMutationPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Receipt className="mr-1.5 h-4 w-4" />}
                      {editingExpense ? "Save changes" : "Save expense"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">Summary</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                    <p className="text-xs text-slate-500 dark:text-neutral-400">Total spent</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-neutral-100">{totalSpentLabel}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-neutral-700 dark:bg-neutral-800">
                    <p className="text-xs text-slate-500 dark:text-neutral-400">Logged expenses</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-neutral-100">{expenseCount}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button type="button" onClick={openAddExpenseView} disabled={participants.length === 0}>
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Add expense
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  <Wallet className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                  Expenses
                </h3>
                {sortedExpenses.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {sortedExpenses.slice(0, 6).map((expense) => (
                      <button
                        type="button"
                        key={`shared-cost-expense-${expense.id}`}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800/70"
                        onClick={() => openEditExpenseView(expense)}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-800 dark:text-neutral-100">{expense.item}</p>
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                            {expense.category} · {expense.participantName}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                          {formatMoney(Number(expense.amount))}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    No expenses yet. Add the first one to start splitting.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                  <Scale className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                  Balances
                </h3>
                {balances.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {balances.map((balance) => (
                      <div
                        key={`shared-cost-balance-${balance.id}`}
                        className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2 dark:border-neutral-700"
                      >
                        <p className="truncate text-sm text-slate-800 dark:text-neutral-100">{balance.name}</p>
                        <div className="text-right">
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400">Paid {formatMoney(balance.paid)}</p>
                          <p className={`text-xs font-semibold ${balance.balance >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}`}>
                            {balance.balance >= 0 ? "+" : ""}
                            {formatMoney(balance.balance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    Add expenses and people to calculate balances.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Suggested paybacks</h3>
                {settlements.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {settlements.map((settlement, index) => (
                      <div
                        key={`shared-cost-settlement-${index}-${settlement.from}-${settlement.to}`}
                        className="rounded-xl border border-slate-200/80 px-3 py-2 text-sm dark:border-neutral-700"
                      >
                        <span className="font-medium text-slate-800 dark:text-neutral-100">{settlement.from}</span>
                        <span className="text-slate-500 dark:text-neutral-400"> pays </span>
                        <span className="font-medium text-slate-800 dark:text-neutral-100">{settlement.to}</span>
                        <span className="text-slate-500 dark:text-neutral-400"> · {formatMoney(settlement.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    Suggested paybacks appear once balances are uneven.
                  </p>
                )}
              </section>
              </div>
            )}
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default SharedCostsDrawer;
