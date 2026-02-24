import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useParticipants } from "@/hooks/use-participants";
import { Modal } from "@/components/ui/modal";
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
import { Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCategoryDef, getPlaceholderKeyForCategory } from "@/config/expenseCategories";
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
}

const DEFAULT_CATEGORIES = ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];

export function AddExpenseDialog({ open, onOpenChange, editingExpense, bbqId, currencySymbol, categories: categoriesProp, defaultItem: defaultItemProp, defaultCategory: defaultCategoryProp, defaultOptIn: defaultOptInProp, allowOptIn = false, onAddCustomCategory }: AddExpenseDialogProps) {
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
        if (participants.data && participants.data.length > 0) {
          setParticipantId(participants.data[0].id.toString());
        }
        const cat = defaultCategoryProp ?? categories[0] ?? "Other";
        setCategory(categories.includes(cat) ? cat : categories[0] ?? "Other");
        setItem(defaultItemProp ?? "");
        setAmount("");
        setOptInByDefault(defaultOptInProp ?? false);
      }
    }
  }, [open, editingExpense, participants.data, categories, defaultItemProp, defaultCategoryProp, defaultOptInProp]);

  const placeholderKey = getPlaceholderKeyForCategory(category);
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
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t.modals.cancel}
          </Button>
          <Button
            type="submit"
            form="add-expense-form"
            disabled={isPending || !participantId || !item.trim() || !amount}
            className="bg-accent text-accent-foreground font-bold"
            data-testid="button-submit-expense"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingExpense ? t.modals.save : t.modals.add}
          </Button>
        </>
      }
      data-testid="modal-add-expense"
    >
      <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="participant" className="uppercase text-xs tracking-wider text-muted-foreground">
            {t.modals.paidByLabel}
          </Label>
          <Select value={participantId} onValueChange={setParticipantId}>
            <SelectTrigger id="participant" className="bg-secondary/50 border-white/10" data-testid="select-expense-person">
              <SelectValue placeholder={t.modals.paidByLabel} />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              {participants.data?.map((p: any) => (
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
