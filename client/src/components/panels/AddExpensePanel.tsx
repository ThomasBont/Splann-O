import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Receipt } from "lucide-react";
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

  const isLoadingData = planQuery.isLoading || crewQuery.isLoading || expensesQuery.isLoading;
  const isValid = !!participantId && !!item.trim() && !!amount && Number(amount) > 0 && (splitMode === "everyone" || includedUserIds.length > 0);
  const includedCount = splitMode === "everyone" ? participants.length : includedUserIds.length;
  const selectedCategory = categories.includes(category) ? category : (categories[0] ?? "Other");
  const placeholderKey = getPlaceholderKeyForCategory(selectedCategory);
  const itemPlaceholder = (t.placeholders as Record<string, string>)[placeholderKey] ?? "e.g. Miscellaneous";

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
        includedUserIds: splitMode === "selected" ? includedUserIds : null,
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
        title={resolutionMode === "now" ? "Add expense" : "Add expense"}
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
                  <Label>Resolution</Label>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setResolutionMode("later")}
                        className={`rounded-xl border px-3 py-3 text-left transition ${resolutionMode === "later" ? "border-primary bg-primary/10" : "border-border/70 bg-background hover:bg-muted/40"}`}
                      >
                        <div className="inline-flex items-center gap-2">
                          <Receipt className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Later settle</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Add this to the shared group costs. It will be included in settle up later.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolutionMode("now")}
                        className={`rounded-xl border px-3 py-3 text-left transition ${resolutionMode === "now" ? "border-primary bg-primary/10" : "border-border/70 bg-background hover:bg-muted/40"}`}
                      >
                        <div className="inline-flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Settle now</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Use this when a few people should pay this back now. It won’t be included in settle up later.
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
                  <Label htmlFor="panel-expense-category">Category</Label>
                  <Select value={selectedCategory} onValueChange={setCategory}>
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
                  <Label>{resolutionMode === "now" ? "Who should pay back?" : "Split"}</Label>
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
                    <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={splitMode === "everyone" ? "default" : "ghost"}
                        className="h-8 rounded-full px-3"
                        onClick={() => setSplitMode("everyone")}
                      >
                        Everyone
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={splitMode === "selected" ? "default" : "ghost"}
                        className="h-8 rounded-full px-3"
                        onClick={() => {
                          setSplitMode("selected");
                          if (includedUserIds.length === 0) {
                            setIncludedUserIds(participants.map((participant: PlanParticipant) => String(participant.id)));
                          }
                        }}
                      >
                        Select people
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {splitMode === "everyone"
                        ? resolutionMode === "now"
                          ? `Everyone except the payer will pay this back (${Math.max(0, participants.length - 1)})`
                          : `Included: Everyone (${participants.length})`
                        : resolutionMode === "now"
                          ? `${includedCount} people will pay this back`
                          : `Included: ${includedCount} people`}
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
