import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Loader2, Receipt, Scale, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCreateExpense } from "@/hooks/use-expenses";
import { useDeleteExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useQueryClient } from "@tanstack/react-query";
import { useAppToast } from "@/hooks/use-app-toast";
import type { ExpenseWithParticipant } from "@shared/schema";
import type { Balance, Settlement } from "@/lib/split/calc";

type SharedCostsDrawerProps = {
  eventId: number | null;
  currentUserId?: number | null;
  creatorUserId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialView?: "overview" | "expense-form";
  initialExpenseId?: number | null;
  planName: string;
  peopleCount: number;
  totalSpentLabel: string;
  expenseCount: number;
  categories: string[];
  participants: Array<{ id: number; name: string; userId?: number | null }>;
  expenses: ExpenseWithParticipant[];
  balances: Balance[];
  settlements: Settlement[];
  formatMoney: (amount: number) => string;
};

function parseIncludedUserIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map((entry) => entry.replace(/^"+|"+$/g, "").trim()).filter(Boolean);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
}

export function SharedCostsDrawer({
  eventId,
  currentUserId = null,
  creatorUserId = null,
  open,
  onOpenChange,
  initialView = "overview",
  initialExpenseId = null,
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
  const [view, setView] = useState<"overview" | "expense-form" | "settle-up">("overview");
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"everyone" | "selected">("everyone");
  const [includedUserIds, setIncludedUserIds] = useState<string[]>([]);
  const [splitEditorOpen, setSplitEditorOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [expensesCollapsed, setExpensesCollapsed] = useState(false);
  const [balancesCollapsed, setBalancesCollapsed] = useState(false);
  const [paybackCollapsed, setPaybackCollapsed] = useState(true);
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
  const canSettle = useMemo(() => balances.some((balance) => Math.abs(balance.balance) > 0.01), [balances]);
  const isCreator = !!(currentUserId && creatorUserId && currentUserId === creatorUserId);
  const myParticipant = useMemo(
    () => (currentUserId ? participants.find((participant) => participant.userId === currentUserId) ?? null : null),
    [participants, currentUserId],
  );
  const myParticipantId = myParticipant?.id ?? null;
  const canEditPayer = isCreator;
  const canSubmitExpenseForm = isCreator || !!myParticipantId;

  const resetAddForm = () => {
    setEditingExpenseId(null);
    if (!isCreator && myParticipantId) {
      setParticipantId(String(myParticipantId));
    } else {
      setParticipantId(participants[0] ? String(participants[0].id) : "");
    }
    setCategory(categories[0] ?? "Other");
    setItem("");
    setAmount("");
    setSplitMode("everyone");
    setIncludedUserIds(participants.map((participant) => String(participant.id)));
    setSplitEditorOpen(false);
    setConfirmDeleteOpen(false);
  };

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setView(initialView);
      resetAddForm();
      if (initialView === "expense-form" && initialExpenseId != null) {
        const initialExpense = expenses.find((expense) => expense.id === initialExpenseId) ?? null;
        if (initialExpense) {
          openEditExpenseView(initialExpense);
        }
      }
    }
    if (!open) {
      setView("overview");
      resetAddForm();
    }
    prevOpenRef.current = open;
  }, [open, categories, participants, initialView, initialExpenseId, expenses]);

  useEffect(() => {
    if (!open) return;
    if (view !== "expense-form") return;
    if (initialExpenseId == null) return;
    const initialExpense = expenses.find((expense) => expense.id === initialExpenseId) ?? null;
    if (!initialExpense) return;
    if (editingExpenseId === initialExpense.id) return;
    openEditExpenseView(initialExpense);
  }, [open, view, initialExpenseId, expenses, editingExpenseId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!open) {
      delete document.body.dataset.sharedCostsDrawerOpen;
      return;
    }
    document.body.dataset.sharedCostsDrawerOpen = "true";
    return () => {
      delete document.body.dataset.sharedCostsDrawerOpen;
    };
  }, [open]);

  const openAddExpenseView = () => {
    resetAddForm();
    setView("expense-form");
  };

  const openSettleUpView = () => {
    setView("settle-up");
  };

  const openEditExpenseView = (expense: ExpenseWithParticipant) => {
    setEditingExpenseId(expense.id);
    if (!isCreator && myParticipantId) {
      // Non-creators cannot reassign payer. Keep existing payer selected unless it's their own expense.
      setParticipantId(String(expense.participantId));
    } else {
      setParticipantId(String(expense.participantId));
    }
    setCategory(expense.category || categories[0] || "Other");
    setItem(expense.item || "");
    setAmount(String(expense.amount));
    const savedIncluded = parseIncludedUserIds(expense.includedUserIds);
    if (savedIncluded.length > 0) {
      setSplitMode("selected");
      setIncludedUserIds(savedIncluded);
    } else {
      setSplitMode("everyone");
      setIncludedUserIds(participants.map((participant) => String(participant.id)));
    }
    setSplitEditorOpen(false);
    setConfirmDeleteOpen(false);
    setView("expense-form");
  };

  const openSettlementExpenseForm = (settlement: Settlement) => {
    const payer = participants.find((participant) => participant.name === settlement.from);
    setEditingExpenseId(null);
    setParticipantId(payer ? String(payer.id) : participants[0] ? String(participants[0].id) : "");
    setCategory(categories.includes("Other") ? "Other" : categories[0] ?? "Other");
    setItem(`Settlement to ${settlement.to}`);
    setAmount(String(settlement.amount));
    setSplitMode("everyone");
    setIncludedUserIds(participants.map((participant) => String(participant.id)));
    setSplitEditorOpen(false);
    setConfirmDeleteOpen(false);
    setView("expense-form");
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !participantId || !item.trim() || !amount || Number(amount) <= 0 || !canSubmitExpenseForm) return;
    if (splitMode === "selected" && includedUserIds.length === 0) return;

    try {
      if (editingExpense) {
        const updatePayload: {
          id: number;
          participantId?: number;
          category: string;
          item: string;
          amount: number;
          includedUserIds: string[] | null;
        } = {
          id: editingExpense.id,
          category,
          item: item.trim(),
          amount: Number(amount),
          includedUserIds: splitMode === "selected" ? includedUserIds : null,
        };
        if (isCreator) {
          updatePayload.participantId = Number(participantId);
        } else if (myParticipantId && editingExpense.participantId === myParticipantId) {
          // For non-creators, only allow payer updates on own expenses (server enforces this too).
          updatePayload.participantId = myParticipantId;
        }
        await updateExpense.mutateAsync({
          ...updatePayload,
        });
      } else {
        const createParticipantId = isCreator ? Number(participantId) : myParticipantId;
        if (!createParticipantId) {
          toastError("Couldn’t determine payer for your account.");
          return;
        }
        await createExpense.mutateAsync({
          participantId: createParticipantId,
          category,
          item: item.trim(),
          amount,
          includedUserIds: splitMode === "selected" ? includedUserIds : null,
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
  const canSaveExpense = Boolean(
    eventId
    && participantId
    && canSubmitExpenseForm
    && item.trim()
    && amount
    && Number(amount) > 0
    && (splitMode === "everyone" || includedUserIds.length > 0),
  );
  const splitIncludedCount = splitMode === "everyone" ? participants.length : includedUserIds.length;
  const collapseStorageKey = eventId ? `sharedCosts:collapsed:${eventId}` : null;

  useEffect(() => {
    if (!collapseStorageKey) {
      setExpensesCollapsed(false);
      setBalancesCollapsed(false);
      setPaybackCollapsed(true);
      return;
    }
    try {
      const raw = localStorage.getItem(collapseStorageKey);
      if (!raw) {
        setExpensesCollapsed(false);
        setBalancesCollapsed(false);
        setPaybackCollapsed(true);
        return;
      }
      const parsed = JSON.parse(raw) as { expenses?: boolean; balances?: boolean; payback?: boolean };
      setExpensesCollapsed(Boolean(parsed.expenses));
      setBalancesCollapsed(Boolean(parsed.balances));
      setPaybackCollapsed(Boolean(parsed.payback));
    } catch {
      setExpensesCollapsed(false);
      setBalancesCollapsed(false);
      setPaybackCollapsed(true);
    }
  }, [collapseStorageKey]);

  useEffect(() => {
    if (!collapseStorageKey) return;
    try {
      localStorage.setItem(
        collapseStorageKey,
        JSON.stringify({
          expenses: expensesCollapsed,
          balances: balancesCollapsed,
          payback: paybackCollapsed,
        }),
      );
    } catch {
      // Ignore storage errors in private mode / blocked storage.
    }
  }, [balancesCollapsed, collapseStorageKey, expensesCollapsed, paybackCollapsed]);

  const stopDrawerEventPropagation = (
    event: React.SyntheticEvent<HTMLElement> | Event,
  ) => {
    event.stopPropagation();
  };

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
        onClick={stopDrawerEventPropagation}
        onMouseDown={stopDrawerEventPropagation}
        onPointerDown={stopDrawerEventPropagation}
        onPointerDownOutside={(event) => {
          // Prevent the outside click from falling through to the underlying hero click handler.
          event.preventDefault();
          event.detail.originalEvent.stopPropagation();
          onOpenChange(false);
        }}
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
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">
                        {editingExpense ? "Edit expense" : "Add expense"}
                      </h3>
                      {editingExpense ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-red-200/80 bg-red-50/70 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40"
                          aria-label="Delete expense"
                          title="Delete expense"
                          disabled={isMutationPending}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setConfirmDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="shared-cost-participant">Paid by</Label>
                        <Select value={participantId} onValueChange={setParticipantId} disabled={!canEditPayer}>
                          <SelectTrigger id="shared-cost-participant" disabled={!canEditPayer}>
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                          <SelectContent>
                            {(canEditPayer ? participants : participants.filter((participant) => String(participant.id) === participantId))
                              .map((participant) => (
                                <SelectItem key={`shared-cost-person-${participant.id}`} value={String(participant.id)}>
                                  {participant.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {!canEditPayer ? (
                          <p className="text-xs text-slate-500 dark:text-neutral-400">Only the plan creator can change who paid.</p>
                        ) : null}
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
                      <div className="space-y-2">
                        <Label>Split</Label>
                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                          <p className="text-sm text-slate-700 dark:text-neutral-200">
                            Split: <span className="font-medium">{splitMode === "everyone" ? "Everyone" : "Selected"} ({splitIncludedCount})</span>
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setSplitEditorOpen((prev) => !prev)}
                          >
                            {splitEditorOpen ? "Done" : "Change"}
                          </Button>
                        </div>
                        {splitEditorOpen ? (
                          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-neutral-700 dark:bg-neutral-800/40">
                            <div className="mb-2 inline-flex items-center gap-1 rounded-lg border border-border/70 bg-background/80 p-1">
                              <Button
                                type="button"
                                variant={splitMode === "everyone" ? "default" : "ghost"}
                                size="sm"
                                className="h-8 rounded-md px-3"
                                onClick={() => setSplitMode("everyone")}
                              >
                                Everyone
                              </Button>
                              <Button
                                type="button"
                                variant={splitMode === "selected" ? "default" : "ghost"}
                                size="sm"
                                className="h-8 rounded-md px-3"
                                onClick={() => {
                                  setSplitMode("selected");
                                  if (includedUserIds.length === 0) {
                                    setIncludedUserIds(participants.map((participant) => String(participant.id)));
                                  }
                                }}
                              >
                                Select people
                              </Button>
                            </div>
                            {splitMode === "selected" ? (
                              <>
                                <p className="mb-2 text-xs text-slate-600 dark:text-neutral-300">Included: {includedUserIds.length} people</p>
                                <div className="space-y-1.5">
                                  {participants.map((participant) => {
                                    const value = String(participant.id);
                                    const checked = includedUserIds.includes(value);
                                    return (
                                      <label
                                        key={`shared-cost-split-${participant.id}`}
                                        className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-white dark:hover:bg-neutral-900/40"
                                      >
                                        <span className="text-sm text-slate-800 dark:text-neutral-100">{participant.name}</span>
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(next) => {
                                            setIncludedUserIds((prev) => {
                                              if (next) return Array.from(new Set([...prev, value]));
                                              return prev.filter((entry) => entry !== value);
                                            });
                                          }}
                                        />
                                      </label>
                                    );
                                  })}
                                </div>
                                {includedUserIds.length === 0 ? (
                                  <p className="mt-2 text-xs text-red-600 dark:text-red-300">Select at least one person.</p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-xs text-slate-500 dark:text-neutral-400">Included: Everyone</p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setView("overview")} disabled={isMutationPending}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!canSaveExpense || isMutationPending}
                    >
                      {isMutationPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Receipt className="mr-1.5 h-4 w-4" />}
                      {editingExpense ? "Save changes" : "Save expense"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : view === "settle-up" ? (
              <div className="space-y-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => setView("overview")}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  Back to costs
                </Button>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Settle up</h3>
                  {!canSettle ? (
                    <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">Nothing to settle.</p>
                  ) : settlements.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {settlements.map((settlement, index) => (
                        <div
                          key={`settle-up-row-${index}-${settlement.from}-${settlement.to}`}
                          className="rounded-xl border border-slate-200/80 px-3 py-2 dark:border-neutral-700"
                        >
                          <p className="text-sm text-slate-800 dark:text-neutral-100">
                            <span className="font-medium">{settlement.from}</span>
                            <span className="text-slate-500 dark:text-neutral-400"> pays </span>
                            <span className="font-medium">{settlement.to}</span>
                            <span className="text-slate-500 dark:text-neutral-400"> · {formatMoney(settlement.amount)}</span>
                          </p>
                          <div className="mt-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openSettlementExpenseForm(settlement)}>
                              Record as expense
                            </Button>
                          </div>
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
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={openAddExpenseView}
                    disabled={participants.length === 0}
                  >
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Add expense
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={openSettleUpView}
                    disabled={!canSettle}
                    title={!canSettle ? "Nothing to settle" : undefined}
                  >
                    <Scale className="mr-1.5 h-4 w-4" />
                    Settle up
                  </Button>
                </div>
                {!canSettle ? (
                  <p className="text-xs text-slate-500 dark:text-neutral-400">Nothing to settle.</p>
                ) : null}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setExpensesCollapsed((prev) => !prev)}
                  aria-expanded={!expensesCollapsed}
                  aria-controls="shared-costs-section-expenses"
                >
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                    <Wallet className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                    Expenses
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-neutral-400">{sortedExpenses.length} expense{sortedExpenses.length === 1 ? "" : "s"}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform dark:text-neutral-400 ${expensesCollapsed ? "" : "rotate-180"}`} />
                  </div>
                </button>
                {!expensesCollapsed ? (sortedExpenses.length > 0 ? (
                  <div id="shared-costs-section-expenses" className="mt-3 space-y-2">
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
                          <p className="text-[11px] text-slate-500 dark:text-neutral-400">
                            Split: {(() => {
                              const ids = parseIncludedUserIds(expense.includedUserIds);
                              return ids.length > 0 ? `${ids.length} people` : "Everyone";
                            })()}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-slate-800 dark:text-neutral-100">
                          {formatMoney(Number(expense.amount))}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p id="shared-costs-section-expenses" className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    No expenses yet. Add the first one to start splitting.
                  </p>
                )) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setBalancesCollapsed((prev) => !prev)}
                  aria-expanded={!balancesCollapsed}
                  aria-controls="shared-costs-section-balances"
                >
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                    <Scale className="h-4 w-4 text-slate-500 dark:text-neutral-400" />
                    Balances
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-neutral-400">{balances.length} people</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform dark:text-neutral-400 ${balancesCollapsed ? "" : "rotate-180"}`} />
                  </div>
                </button>
                {!balancesCollapsed ? (balances.length > 0 ? (
                  <div id="shared-costs-section-balances" className="mt-3 space-y-2">
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
                  <p id="shared-costs-section-balances" className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    Add expenses and people to calculate balances.
                  </p>
                )) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setPaybackCollapsed((prev) => !prev)}
                  aria-expanded={!paybackCollapsed}
                  aria-controls="shared-costs-section-paybacks"
                >
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Suggested paybacks</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-neutral-400">{settlements.length} suggestion{settlements.length === 1 ? "" : "s"}</span>
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform dark:text-neutral-400 ${paybackCollapsed ? "" : "rotate-180"}`} />
                  </div>
                </button>
                {!paybackCollapsed ? (settlements.length > 0 ? (
                  <div id="shared-costs-section-paybacks" className="mt-3 space-y-2">
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
                  <p id="shared-costs-section-paybacks" className="mt-2 text-sm text-slate-500 dark:text-neutral-400">
                    Suggested paybacks appear once balances are uneven.
                  </p>
                )) : null}
              </section>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the expense from shared costs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutationPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isMutationPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteExpense().then(() => {
                  setConfirmDeleteOpen(false);
                });
              }}
            >
              {isMutationPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

export default SharedCostsDrawer;
