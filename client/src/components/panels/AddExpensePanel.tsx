import { useEffect, useMemo, useState } from "react";
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
import { useCreateExpense } from "@/hooks/use-expenses";
import { useLanguage } from "@/hooks/use-language";
import { usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import { PanelHeader, PanelSection, PanelShell, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { getPlaceholderKeyForCategory } from "@/config/expenseCategories";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["Food", "Drinks", "Transport", "Accommodation", "Activities", "Other"];
type PlanParticipant = { id: number; name: string; userId?: number | null };

export function AddExpensePanel({
  source = "overview",
  initialResolutionMode = "later",
}: {
  source?: "overview" | "expenses";
  initialResolutionMode?: "later" | "now";
}) {
  const eventId = useActiveEventId();
  const { t } = useLanguage();
  const { toastError, toastSuccess } = useAppToast();
  const { replacePanel } = usePanel();
  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const createExpense = useCreateExpense(eventId);
  const plan = planQuery.data;
  const participants = (crewQuery.data?.participants ?? []) as PlanParticipant[];
  const expenses = expensesQuery.data ?? [];

  const categories = useMemo(() => {
    const fromExpenses = Array.from(new Set(expenses.map((expense) => String(expense.category || "").trim()).filter(Boolean)));
    const merged = [...fromExpenses, ...DEFAULT_CATEGORIES];
    return Array.from(new Set(merged));
  }, [expenses]);

  const [participantId, setParticipantId] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"everyone" | "selected">("everyone");
  const [includedUserIds, setIncludedUserIds] = useState<string[]>([]);
  const [resolutionMode, setResolutionMode] = useState<"later" | "now">(initialResolutionMode);
  const [showAdvancedSplit, setShowAdvancedSplit] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(false);

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

  const isLoadingData = planQuery.isLoading || crewQuery.isLoading || expensesQuery.isLoading;
  const isValid = !!participantId
    && !!item.trim()
    && !!amount
    && Number(amount) > 0
    && (resolutionMode === "now"
      ? includedUserIds.length > 0
      : splitMode === "everyone" || includedUserIds.length > 0);
  const includedCount = splitMode === "everyone" ? participants.length : includedUserIds.length;
  const selectedCategory = categories.includes(category) ? category : (categories[0] ?? "Other");
  const placeholderKey = getPlaceholderKeyForCategory(selectedCategory);
  const itemPlaceholder = categoryTouched
    ? (t.placeholders as Record<string, string>)[placeholderKey] ?? "e.g. Miscellaneous"
    : "e.g. pizza, taxi, hotel, groceries...";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!eventId || !isValid) return;
    try {
      const created = await createExpense.mutateAsync({
        participantId: Number(participantId),
        category: selectedCategory,
        item: item.trim(),
        amount,
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
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Couldn’t add expense. Try again.");
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
                  <Label htmlFor="panel-expense-payer">Paid by</Label>
                  <Select
                    value={participantId}
                    onValueChange={setParticipantId}
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
                    onChange={(event) => setItem(event.target.value)}
                    placeholder={itemPlaceholder}
                  />
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
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="panel-expense-category">Category</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(val) => {
                      setCategory(val);
                      setCategoryTouched(true);
                    }}
                  >
                    <SelectTrigger id="panel-expense-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((entry) => (
                        <SelectItem key={`panel-expense-category-${entry}`} value={entry}>
                          {entry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                onClick={() => replacePanel({ type: source === "expenses" ? "expenses" : "overview" })}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || createExpense.isPending}>
                {createExpense.isPending ? "Saving..." : (
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {resolutionMode === "now" ? "Add expense & settle now" : "Add Expense"}
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
