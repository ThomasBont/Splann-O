import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, CreditCard, Receipt, Users } from "lucide-react";
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
import { useAppToast } from "@/hooks/use-app-toast";
import { useAuth } from "@/hooks/use-auth";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useLanguage } from "@/hooks/use-language";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { getExpenseLockState } from "@shared/lib/expense-lock";
import { cn } from "@/lib/utils";
type PlanParticipant = { id: number; name: string; userId?: number | null };

function formatDetectedReceiptDate(value: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export function AddExpensePanel({
  source = "overview",
  editExpenseId = null,
  initialResolutionMode = "later",
  initialPrefill = null,
}: {
  source?: "overview" | "expenses";
  editExpenseId?: number | null;
  initialResolutionMode?: "later" | "now";
  initialPrefill?: {
    amount?: number | null;
    item?: string | null;
    paidBy?: string | null;
    splitCount?: number | null;
  } | null;
}) {
  const eventId = useActiveEventId();
  const { t } = useLanguage();
  const { toastError, toastSuccess } = useAppToast();
  const { user } = useAuth();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const createExpense = useCreateExpense(eventId);
  const updateExpense = useUpdateExpense(eventId);
  const plan = planQuery.data;
  const participants = (crewQuery.data?.participants ?? []) as PlanParticipant[];
  const editingExpense = editExpenseId == null
    ? null
    : (expensesQuery.data ?? []).find((expense: { id?: number }) => Number(expense.id) === Number(editExpenseId)) ?? null;
  const editingLockState = getExpenseLockState({
    planStatus: plan?.status,
    settlementStarted: Boolean((plan as { settlementStarted?: boolean | null } | null)?.settlementStarted),
    linkedSettlementRoundId: (editingExpense as { linkedSettlementRoundId?: string | null } | null)?.linkedSettlementRoundId ?? null,
    settledAt: (editingExpense as { settledAt?: string | Date | null } | null)?.settledAt ?? null,
    excludedFromFinalSettlement: (editingExpense as { excludedFromFinalSettlement?: boolean | null } | null)?.excludedFromFinalSettlement ?? false,
    resolutionMode: (editingExpense as { resolutionMode?: string | null } | null)?.resolutionMode ?? null,
  });
  const isEditing = !!editingExpense;
  const canEditPayer = isEditing ? Number(plan?.creatorUserId ?? 0) === Number(user?.id ?? 0) : true;

  const [participantId, setParticipantId] = useState("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"everyone" | "selected">("everyone");
  const [includedUserIds, setIncludedUserIds] = useState<string[]>([]);
  const [resolutionMode, setResolutionMode] = useState<"later" | "now">(initialResolutionMode);
  const [showAdvancedSplit, setShowAdvancedSplit] = useState(false);
  const [itemTouchedByUser, setItemTouchedByUser] = useState(false);
  const [amountTouchedByUser, setAmountTouchedByUser] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [dateTouchedByUser, setDateTouchedByUser] = useState(false);
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);
  const [receiptScanError, setReceiptScanError] = useState<string | null>(null);
  const [receiptDetectedMerchant, setReceiptDetectedMerchant] = useState<string | null>(null);
  const [receiptDetectedAmount, setReceiptDetectedAmount] = useState<number | null>(null);
  const [receiptDetectedDate, setReceiptDetectedDate] = useState<string | null>(null);
  const [receiptAmountConfidence, setReceiptAmountConfidence] = useState<number>(0);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!participants.length) {
      if (participantId) setParticipantId("");
      return;
    }
    if (participantId && participants.some((participant) => String(participant.id) === participantId)) return;
    const currentUserParticipant = participants.find((participant) => participant.userId && participant.userId === user?.id);
    setParticipantId(String(currentUserParticipant?.id ?? participants[0]?.id ?? ""));
  }, [participantId, participants, user?.id]);

  useEffect(() => {
    if (!initialPrefill) return;
    if (initialPrefill.item && String(initialPrefill.item).trim() && !itemTouchedByUser) {
      setItem(String(initialPrefill.item).trim());
    }
    if (Number.isFinite(Number(initialPrefill.amount)) && Number(initialPrefill.amount) > 0 && !amountTouchedByUser) {
      setAmount(String(Number(initialPrefill.amount)));
    }
    if (initialPrefill.paidBy && String(initialPrefill.paidBy).trim()) {
      const query = String(initialPrefill.paidBy).trim().toLowerCase();
      const normalizedQuery = query.replace(/[^a-z0-9_]/g, "");
      const matchedParticipant = participants.find((participant) => {
        const name = participant.name.toLowerCase();
        const normalizedName = name.replace(/[^a-z0-9_]/g, "");
        return name === query || normalizedName === normalizedQuery || name.includes(query);
      });
      if (matchedParticipant) {
        setParticipantId(String(matchedParticipant.id));
      }
    }
    const splitCount = Number(initialPrefill.splitCount);
    if (Number.isFinite(splitCount) && splitCount > 0 && participants.length > 0) {
      const limited = participants.slice(0, Math.max(1, Math.min(participants.length, Math.floor(splitCount))));
      if (limited.length >= participants.length) {
        setSplitMode("everyone");
        setIncludedUserIds(participants.map((participant) => String(participant.id)));
      } else {
        setSplitMode("selected");
        setIncludedUserIds(limited.map((participant) => String(participant.id)));
      }
    }
  }, [amountTouchedByUser, initialPrefill, itemTouchedByUser, participants]);

  useEffect(() => {
    if (resolutionMode === "now") {
      setSplitMode("selected");
      const payerIdStr = String(participantId);
      const others = participants
        .map((p: PlanParticipant) => String(p.id))
        .filter((id) => id !== payerIdStr);
      setIncludedUserIds(others.length > 0 ? others : participants.map((p: PlanParticipant) => String(p.id)));
    }
  }, [participants, participantId, resolutionMode]);

  useEffect(() => {
    if (resolutionMode !== "now" || !participantId) return;
    const payerIdStr = String(participantId);
    setIncludedUserIds(
      participants
        .map((p: PlanParticipant) => String(p.id))
        .filter((id) => id !== payerIdStr),
    );
  }, [participantId, participants, resolutionMode]);

  useEffect(() => {
    if (!editingExpense) return;
    setParticipantId(String((editingExpense as { participantId?: number | null }).participantId ?? ""));
    setItem(String((editingExpense as { item?: string | null }).item ?? ""));
    setAmount(String(Number((editingExpense as { amount?: number | string | null }).amount ?? 0) || ""));
    setExpenseDate(String((editingExpense as { occurredOn?: string | null }).occurredOn ?? ""));
    const nextResolutionMode = String((editingExpense as { resolutionMode?: string | null }).resolutionMode ?? "later").trim().toLowerCase() === "now"
      ? "now"
      : "later";
    setResolutionMode(nextResolutionMode);
    const included = Array.isArray((editingExpense as { includedUserIds?: unknown }).includedUserIds)
      ? ((editingExpense as { includedUserIds?: unknown[] }).includedUserIds ?? []).map((value) => String(value))
      : [];
    if (nextResolutionMode === "now") {
      setSplitMode("selected");
      setIncludedUserIds(included);
    } else if (included.length > 0) {
      setSplitMode("selected");
      setIncludedUserIds(included);
    } else {
      setSplitMode("everyone");
      setIncludedUserIds(participants.map((participant) => String(participant.id)));
    }
  }, [editingExpense, participants]);

  const isLoadingData = planQuery.isLoading || crewQuery.isLoading;
  const isReadOnly = isEditing && editingLockState.locked;
  const isValid = !!participantId
    && !!item.trim()
    && !!amount
    && Number(amount) > 0
    && (resolutionMode === "now"
      ? includedUserIds.length > 0
      : splitMode === "everyone" || includedUserIds.length > 0);
  const includedCount = splitMode === "everyone" ? participants.length : includedUserIds.length;
  const itemPlaceholder = "e.g. pizza, taxi, hotel, groceries...";
  const itemDetectedFromReceipt = !!receiptDetectedMerchant && !itemTouchedByUser;
  const amountDetectedFromReceipt = receiptDetectedAmount != null && !amountTouchedByUser;
  const dateDetectedFromReceipt = !!receiptDetectedDate && !dateTouchedByUser;

  const handleScanReceipt = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setReceiptScanError("Use an image file for receipt scanning.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReceiptScanError("Receipt image must be 5MB or smaller.");
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read receipt image"));
      reader.readAsDataURL(file);
    });

    setIsScanningReceipt(true);
    setReceiptScanError(null);
    setReceiptAmountConfidence(0);
    try {
      const res = await fetch("/api/receipts/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });
      const body = await res.json().catch(() => ({} as {
        message?: string;
        merchant?: string | null;
        amount?: number | null;
        date?: string | null;
        confidence?: { merchant?: number; amount?: number; date?: number } | null;
      }));
      if (!res.ok) {
        throw new Error(body.message || "Couldn’t scan receipt.");
      }

      const merchant = typeof body.merchant === "string" && body.merchant.trim().length > 0
        ? body.merchant.trim()
        : null;
      const total = typeof body.amount === "number" && Number.isFinite(body.amount)
        ? body.amount
        : null;
      const date = typeof body.date === "string" && body.date.trim().length > 0
        ? body.date.trim()
        : null;
      const amountConfidence = typeof body.confidence?.amount === "number" ? body.confidence.amount : 0;

      setReceiptDetectedMerchant(merchant);
      setReceiptDetectedAmount(total);
      setReceiptDetectedDate(date);
      setReceiptAmountConfidence(amountConfidence);

      if (merchant && !itemTouchedByUser && !item.trim()) {
        setItem(merchant);
      }
      if (total != null && !amountTouchedByUser && !amount.trim()) {
        setAmount(total.toFixed(2));
      }
      if (date && !dateTouchedByUser && !expenseDate.trim()) {
        setExpenseDate(date);
      }

      if (!merchant && total == null && !date) {
        setReceiptScanError("We scanned the receipt, but couldn’t confidently detect useful details.");
      }
    } catch (error) {
      setReceiptScanError(error instanceof Error ? error.message : "Couldn’t scan receipt.");
    } finally {
      setIsScanningReceipt(false);
      if (receiptInputRef.current) {
        receiptInputRef.current.value = "";
      }
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventId || !isValid || isReadOnly) return;
    try {
      if (editingExpense) {
        await updateExpense.mutateAsync({
          id: Number((editingExpense as { id?: number }).id),
          participantId: canEditPayer ? Number(participantId) : undefined,
          item: item.trim(),
          amount: Number(amount),
          occurredOn: expenseDate.trim() || null,
          includedUserIds: splitMode === "selected" || resolutionMode === "now" ? includedUserIds : null,
        });
        toastSuccess("Expense updated");
        replacePanel({ type: "expense", id: String((editingExpense as { id?: number }).id ?? "") });
      } else {
        const created = await createExpense.mutateAsync({
          participantId: Number(participantId),
          item: item.trim(),
          amount,
          occurredOn: expenseDate.trim() || null,
          resolutionMode,
          includedUserIds: resolutionMode === "now"
            ? includedUserIds
            : splitMode === "selected" ? includedUserIds : null,
        });
        toastSuccess(resolutionMode === "now" ? "Expense added and settled now" : "Expense added");
        const linkedSettlementRoundId = String((created as { linkedSettlementRoundId?: string | null }).linkedSettlementRoundId ?? "").trim();
        if (resolutionMode === "now" && linkedSettlementRoundId) {
          replacePanel({ type: "settlement", settlementId: linkedSettlementRoundId });
          return;
        }
        replacePanel({ type: "expenses" });
      }
    } catch (error) {
      toastError(error instanceof Error ? error.message : isEditing ? "Couldn’t update expense. Try again." : "Couldn’t add expense. Try again.");
    }
  };

  return (
    <PanelShell>
      <PanelHeader
        label="Expense"
        title="Add expense"
        meta={plan ? <span className="text-sm text-muted-foreground">{plan.name}</span> : undefined}
      />
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!eventId ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat first.
          </div>
        ) : isLoadingData ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            Loading expense form...
          </div>
        ) : participants.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4 text-sm text-muted-foreground">
            Add participants first before adding expenses.
          </div>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <PanelSection title="Record expense" variant="default">
              <div className="space-y-4">
                {isReadOnly ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-3 text-sm text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
                    {editingLockState.message}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>How to settle this?</Label>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setResolutionMode("later");
                          setShowAdvancedSplit(false);
                        }}
                        disabled={isEditing}
                        className={`rounded-xl border px-3 py-3 text-left transition ${resolutionMode === "later" ? "border-primary bg-primary/10" : "border-border/70 bg-background hover:bg-muted/40"}`}
                      >
                        <div className="inline-flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Later settle</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Goes into the shared group pot. Included in final settle up.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResolutionMode("now");
                          setShowAdvancedSplit(false);
                        }}
                        disabled={isEditing}
                        className={`rounded-xl border px-3 py-3 text-left transition ${resolutionMode === "now" ? "border-primary bg-primary/10" : "border-border/70 bg-background hover:bg-muted/40"}`}
                      >
                        <div className="inline-flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Settle now</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Ask the involved people to pay back right away. Won't affect final settle up.
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scan receipt</Label>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={receiptInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          void handleScanReceipt(file);
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => receiptInputRef.current?.click()}
                        disabled={isScanningReceipt}
                      >
                        <Receipt className="mr-1.5 h-4 w-4" />
                        {isScanningReceipt ? "Scanning receipt..." : "Upload receipt"}
                      </Button>
                      {(receiptDetectedMerchant || receiptDetectedAmount != null || receiptDetectedDate) && !isScanningReceipt ? (
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          Detected from receipt
                        </span>
                      ) : null}
                    </div>
                    {receiptScanError ? (
                      <p className="mt-2 text-xs text-destructive">{receiptScanError}</p>
                    ) : null}
                    {receiptDetectedDate ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Receipt date detected: {formatDetectedReceiptDate(receiptDetectedDate)}
                      </p>
                    ) : null}
                    {receiptDetectedAmount != null && receiptAmountConfidence > 0 && receiptAmountConfidence < 0.7 ? (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">
                        Review the detected total before saving.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-expense-payer">Paid by</Label>
                  <Select
                    value={participantId}
                    onValueChange={setParticipantId}
                    disabled={isReadOnly || !canEditPayer}
                  >
                    <SelectTrigger id="panel-expense-payer">
                      <SelectValue placeholder="Select person" />
                    </SelectTrigger>
                    <SelectContent>
                      {participants.map((participant: PlanParticipant) => (
                        <SelectItem key={`panel-expense-payer-${participant.id}`} value={String(participant.id)}>
                          {participant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-expense-item">Item description</Label>
                  <Input
                    id="panel-expense-item"
                    value={item}
                    onChange={(event) => {
                      setItemTouchedByUser(true);
                      setItem(event.target.value);
                    }}
                    disabled={isReadOnly}
                    placeholder={itemPlaceholder}
                  />
                  {itemDetectedFromReceipt ? (
                    <p className="text-[11px] font-medium text-primary">Detected from receipt</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-expense-amount">Amount (€)</Label>
                  <Input
                    id="panel-expense-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => {
                      setAmountTouchedByUser(true);
                      setAmount(event.target.value);
                    }}
                    disabled={isReadOnly}
                    placeholder="0.00"
                  />
                  {amountDetectedFromReceipt ? (
                    <p className="text-[11px] font-medium text-primary">Detected from receipt</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-expense-date">Date (optional)</Label>
                  <Input
                    id="panel-expense-date"
                    type="date"
                    value={expenseDate}
                    onChange={(event) => {
                      setDateTouchedByUser(true);
                      setExpenseDate(event.target.value);
                    }}
                    disabled={isReadOnly}
                  />
                  {dateDetectedFromReceipt ? (
                    <p className="text-[11px] font-medium text-primary">Detected from receipt</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label>{resolutionMode === "now" ? "Who should pay back?" : "Who's included?"}</Label>
                  {resolutionMode === "now" ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                      <p className="mb-2 text-xs text-muted-foreground">
                        Select the people who owe you for this expense.
                      </p>
                      <div className="space-y-1.5">
                        {participants.map((participant: PlanParticipant) => {
                          const value = String(participant.id);
                          const isPayer = value === String(participantId);
                          const checked = includedUserIds.includes(value);
                          return (
                            <label
                              key={`panel-expense-split-${participant.id}`}
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5",
                                isPayer ? "cursor-not-allowed opacity-40" : "hover:bg-background",
                              )}
                            >
                              <span className="text-sm text-foreground">
                                {participant.name}
                                {isPayer ? (
                                  <span className="ml-1.5 text-xs text-muted-foreground">(payer)</span>
                                ) : null}
                              </span>
                              <Checkbox
                                checked={checked}
                                disabled={isPayer}
                                onCheckedChange={(next) => {
                                  if (isReadOnly) return;
                                  if (isPayer) return;
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
                        <p className="mt-2 text-xs text-destructive">
                          Select at least one person.
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {includedUserIds.length} {includedUserIds.length === 1 ? "person" : "people"} will pay this back
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                        onClick={() => setShowAdvancedSplit((v) => !v)}
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvancedSplit && "rotate-180")} />
                        {showAdvancedSplit ? "Hide split options" : "Change who's included"}
                      </button>
                      {showAdvancedSplit ? (
                        <div className="mt-2 rounded-xl border border-border/70 bg-muted/20 p-2.5">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setSplitMode("everyone")}
                              disabled={isReadOnly}
                              className={`rounded-xl border px-3 py-3 text-left transition ${
                                splitMode === "everyone"
                                  ? "border-primary bg-primary/10"
                                  : "border-border/70 bg-background hover:bg-muted/40"
                              }`}
                            >
                              <div className="inline-flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Everyone</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Split equally with all plan members.
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isReadOnly) return;
                                setSplitMode("selected");
                                if (includedUserIds.length === 0) {
                                  setIncludedUserIds(participants.map((p: PlanParticipant) => String(p.id)));
                                }
                              }}
                              className={`rounded-xl border px-3 py-3 text-left transition ${
                                splitMode === "selected"
                                  ? "border-primary bg-primary/10"
                                  : "border-border/70 bg-background hover:bg-muted/40"
                              }`}
                            >
                              <div className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-foreground">Select people</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Choose which members are included.
                              </p>
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {splitMode === "everyone"
                              ? `Everyone included (${participants.length})`
                              : `${includedCount} people included`}
                          </p>
                          {splitMode === "selected" ? (
                            <div className="mt-2 space-y-1.5">
                              {participants.map((participant: PlanParticipant) => {
                                const value = String(participant.id);
                                const checked = includedUserIds.includes(value);
                                return (
                                  <label key={`panel-expense-split-${participant.id}`} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-background">
                                    <span className="text-sm text-foreground">{participant.name}</span>
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(next) => {
                                        if (isReadOnly) return;
                                        setIncludedUserIds((prev) => {
                                          if (next) return Array.from(new Set([...prev, value]));
                                          return prev.filter((entry) => entry !== value);
                                        });
                                      }}
                                    />
                                  </label>
                                );
                              })}
                              {includedUserIds.length === 0 ? (
                                <p className="text-xs text-destructive">Select at least one person.</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </PanelSection>

            <div className="flex items-center justify-between gap-3 px-1 pb-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => replacePanel(
                  isEditing
                    ? { type: "expense", id: String((editingExpense as { id?: number }).id ?? "") }
                    : { type: source === "expenses" ? "expenses" : "overview" },
                )}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || isReadOnly || createExpense.isPending || updateExpense.isPending}>
                {createExpense.isPending || updateExpense.isPending ? "Saving..." : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {isEditing ? "Save changes" : resolutionMode === "now" ? "Add expense & settle now" : "Add Expense"}
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PanelShell>
  );
}

export default AddExpensePanel;
