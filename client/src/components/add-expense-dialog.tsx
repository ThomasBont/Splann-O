import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useParticipants } from "@/hooks/use-participants";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { PremiumPressable } from "@/components/ui/premium-pressable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCategoryDef, getPlaceholderKeyForCategory } from "@/config/expenseCategories";
import { getExpensePlaceholderKey, getThemeConfig, type ThemeId } from "@/themes/themeRegistry";
import { getSmartDefaultsForGroup, resolveExpenseDefaults, updateSmartDefaultsAfterExpenseCreate } from "@/lib/smart-defaults";
import type { ExpenseWithParticipant } from "@shared/schema";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingExpense?: ExpenseWithParticipant | null;
  bbqId: number | null;
  currencySymbol: string;
  categories?: string[];
  defaultItem?: string;
  defaultCategory?: string;
  defaultOptIn?: boolean;
  allowOptIn?: boolean;
  onAddCustomCategory?: (name: string) => void;
  /** Event type for theme-aware placeholder (e.g. barbecue, city_trip) */
  eventType?: string | null;
  /** Event kind for theme resolution */
  eventKind?: "party" | "trip";
  currentUsername?: string | null;
  currencyCode?: string | null;
  groupHomeCurrencyCode?: string | null;
}

const DEFAULT_CATEGORIES = ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];

export function AddExpenseDialog({ open, onOpenChange, editingExpense, bbqId, currencySymbol, categories: categoriesProp, defaultItem: defaultItemProp, defaultCategory: defaultCategoryProp, defaultOptIn: defaultOptInProp, allowOptIn = false, onAddCustomCategory, eventType, eventKind = "party", currentUsername, currencyCode, groupHomeCurrencyCode }: AddExpenseDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const participants = useParticipants(bbqId);
  const createExpense = useCreateExpense(bbqId);
  const updateExpense = useUpdateExpense(bbqId);

  const categories = categoriesProp ?? DEFAULT_CATEGORIES;

  const [participantId, setParticipantId] = useState<string>("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [optInByDefault, setOptInByDefault] = useState(false);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  const participantList = (participants.data ?? []) as Array<{ id: number; userId?: string | null; name: string }>;
  const smartStored = useMemo(() => getSmartDefaultsForGroup(bbqId), [bbqId, open]);
  const resolvedDefaults = useMemo(
    () =>
      resolveExpenseDefaults({
        groupId: bbqId,
        currentUserId: currentUsername,
        groupMembers: participantList,
        storedDefaults: smartStored.defaults,
        storedStats: smartStored.stats,
        groupHomeCurrencyCode,
        appDefaultCurrencyCode: currencyCode,
      }),
    [bbqId, currentUsername, participantList, smartStored.defaults, smartStored.stats, groupHomeCurrencyCode, currencyCode]
  );
  const orderedParticipants = useMemo(() => {
    if (!participantList.length) return participantList;
    const rank = new Map(resolvedDefaults.orderedParticipantIds.map((id, idx) => [id, idx]));
    return [...participantList].sort((a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }, [participantList, resolvedDefaults.orderedParticipantIds]);

  useEffect(() => {
    if (open) {
      setShowCustomCategoryInput(false);
      setCustomCategoryName("");
      if (editingExpense) {
        setParticipantId(editingExpense.participantId?.toString() || "");
        setCategory(editingExpense.category);
        setItem(editingExpense.item);
        setAmount(editingExpense.amount.toString());
        setOptInByDefault(false);
      } else {
        if (participantList.length > 0) {
          const suggestedPayerId = resolvedDefaults.payerParticipantId ?? participantList[0].id;
          setParticipantId(String(suggestedPayerId));
        }
        const rememberedCategory = smartStored.defaults?.lastCategory;
        const cat = defaultCategoryProp ?? (rememberedCategory && categories.includes(rememberedCategory) ? rememberedCategory : undefined) ?? categories[0] ?? "Other";
        setCategory(categories.includes(cat) ? cat : categories[0] ?? "Other");
        setItem(defaultItemProp ?? "");
        setAmount("");
        setOptInByDefault(defaultOptInProp ?? false);
      }
    }
  }, [open, editingExpense, participantList, categories, defaultItemProp, defaultCategoryProp, defaultOptInProp, resolvedDefaults.payerParticipantId, smartStored.defaults?.lastCategory]);

  const themeId = eventType && eventKind ? (getThemeConfig(eventKind, eventType).id as ThemeId) : null;
  const placeholderKey = themeId != null ? getExpensePlaceholderKey(category, themeId) : getPlaceholderKeyForCategory(category);
  const itemPlaceholder = (t.placeholders as Record<string, string>)[placeholderKey] ?? "e.g. Miscellaneous";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId || !item.trim() || !amount || parseFloat(amount) <= 0) return;

    const payload = {
      participantId: parseInt(participantId),
      category,
      item: item.trim(),
      amount: amount
    };

    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, ...payload }, {
        onSuccess: () => {
          toast({ variant: "success", message: t.modals.expenseUpdated });
          onOpenChange(false);
        },
        onError: () => toast({ variant: "error", message: t.modals.expenseAddFailed }),
      });
    } else {
      createExpense.mutate(
        allowOptIn ? { ...payload, optInByDefault: optInByDefault } : payload,
        {
          onSuccess: () => {
            const payer = participantList.find((p) => String(p.id) === participantId);
            if (bbqId) {
              updateSmartDefaultsAfterExpenseCreate({
                groupId: bbqId,
                currentUserId: currentUsername,
                currencyCode,
                splitMethod: "equally",
                payerParticipantId: parseInt(participantId),
                payerUserId: payer?.userId ?? null,
                participantIds: [parseInt(participantId)],
                category,
              });
            }
            toast({ variant: "success", message: t.modals.expenseAdded });
            onOpenChange(false);
          },
          onError: () => toast({ variant: "error", message: t.modals.expenseAddFailed }),
        }
      );
    }
  };

  const isPending = createExpense.isPending || updateExpense.isPending;

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      onOpenChange={onOpenChange}
      title={editingExpense ? t.modals.editExpenseTitle : t.modals.addExpenseTitle}
      size="md"
      scrollable
      footer={
        <>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            {t.modals.cancel}
          </Button>
          <PremiumPressable asChild disabled={isPending || !participantId || !item.trim() || !amount}>
            <Button
              type="submit"
              form="add-expense-form"
              disabled={isPending || !participantId || !item.trim() || !amount}
              className="w-full sm:w-auto bg-accent text-accent-foreground font-semibold shadow-lg shadow-accent/20 hover:shadow-accent/30"
              data-testid="button-submit-expense"
            >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingExpense ? t.modals.save : t.modals.add}
          </Button>
          </PremiumPressable>
        </>
      }
      data-testid="modal-add-expense"
    >
      <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="participant" className="uppercase text-xs tracking-wider text-muted-foreground">
              {t.modals.paidByLabel}
            </Label>
            {!editingExpense && resolvedDefaults.payerSuggestionSource !== "fallback" ? (
              <span className="text-[11px] text-muted-foreground">
                {resolvedDefaults.payerSuggestionSource === "lastUsed" ? "Last used" : "Suggested"}
              </span>
            ) : null}
          </div>
          <Select value={participantId} onValueChange={setParticipantId}>
            <SelectTrigger id="participant" className="bg-secondary/50 border-white/10" data-testid="select-expense-person">
              <SelectValue placeholder={t.modals.paidByLabel} />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {orderedParticipants.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category" className="uppercase text-xs tracking-wider text-muted-foreground">
            {t.modals.categoryLabel}
          </Label>
          <Select
            value={category}
            onValueChange={(v) => {
              if (v === "__create__") setShowCustomCategoryInput(true);
              else setCategory(v);
            }}
          >
            <SelectTrigger id="category" className="bg-secondary/50 border-white/10" data-testid="select-expense-category">
              <SelectValue placeholder={t.modals.categoryLabel}>
                <span className="flex items-center gap-2">
                  {(() => {
                    const def = getCategoryDef(category);
                    const Icon = def.icon;
                    return (
                      <>
                        <Icon className="w-4 h-4 shrink-0" />
                        {t.categories[def.i18nKey as keyof typeof t.categories] ?? category}
                      </>
                    );
                  })()}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {categories.map((cat) => {
                const def = getCategoryDef(cat);
                const Icon = def.icon;
                return (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      {t.categories[def.i18nKey as keyof typeof t.categories] ?? cat}
                    </span>
                  </SelectItem>
                );
              })}
              {onAddCustomCategory && (
                <SelectItem value="__create__">
                  <span className="flex items-center gap-2 text-primary">
                    <Plus className="w-4 h-4 shrink-0" />
                    {t.modals.createCustomCategory}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {showCustomCategoryInput && onAddCustomCategory && (
            <div className="flex gap-2 items-center pt-1">
              <Input
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder={t.modals.categoryLabel}
                className="bg-secondary/50 border-white/10 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCategoryName.trim()) {
                    onAddCustomCategory(customCategoryName.trim());
                    setCategory(customCategoryName.trim());
                    setShowCustomCategoryInput(false);
                    setCustomCategoryName("");
                  }
                  if (e.key === "Escape") {
                    setShowCustomCategoryInput(false);
                    setCustomCategoryName("");
                  }
                }}
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (customCategoryName.trim()) {
                    onAddCustomCategory(customCategoryName.trim());
                    setCategory(customCategoryName.trim());
                    setShowCustomCategoryInput(false);
                    setCustomCategoryName("");
                  }
                }}
                disabled={!customCategoryName.trim()}
              >
                {t.modals.add}
              </Button>
            </div>
          )}
        </div>

        {allowOptIn && (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="expense-opt-in"
              checked={optInByDefault}
              onChange={(e) => setOptInByDefault(e.target.checked)}
              className="rounded border-white/20"
              data-testid="checkbox-expense-opt-in"
            />
            <Label htmlFor="expense-opt-in" className="text-sm cursor-pointer">
              {t.bbq.optInExpenseLabel}
            </Label>
            <span className="text-xs text-muted-foreground">
              ({optInByDefault ? t.bbq.optInExpenseHintOn : t.bbq.optInExpenseHintOff})
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="item" className="uppercase text-xs tracking-wider text-muted-foreground">
            {t.modals.itemLabel}
          </Label>
          <Input
            id="item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder={itemPlaceholder}
            className="bg-secondary/50 border-white/10 focus-visible:ring-accent/50"
            data-testid="input-expense-item"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount" className="uppercase text-xs tracking-wider text-muted-foreground">
            {t.modals.amountLabel} ({currencySymbol})
          </Label>
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="bg-secondary/50 border-white/10 font-mono text-lg focus-visible:ring-accent/50"
            data-testid="input-expense-amount"
          />
        </div>
      </form>
    </Modal>
  );
}
