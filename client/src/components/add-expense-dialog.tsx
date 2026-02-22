import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { useParticipants } from "@/hooks/use-participants";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DraggableDialogContent } from "@/components/ui/draggable-dialog-content";
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
import { Loader2 } from "lucide-react";
import type { ExpenseWithParticipant } from "@shared/schema";

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingExpense?: ExpenseWithParticipant | null;
  bbqId: number | null;
  currencySymbol: string;
  /** Category keys for the current event type (e.g. barbecue vs city_trip). Defaults to barbecue set if omitted. */
  categories?: string[];
}

const DEFAULT_CATEGORIES = ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];

export function AddExpenseDialog({ open, onOpenChange, editingExpense, bbqId, currencySymbol, categories: categoriesProp }: AddExpenseDialogProps) {
  const { t } = useLanguage();
  const participants = useParticipants(bbqId);
  const createExpense = useCreateExpense(bbqId);
  const updateExpense = useUpdateExpense(bbqId);

  const categories = categoriesProp ?? DEFAULT_CATEGORIES;

  const [participantId, setParticipantId] = useState<string>("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      if (editingExpense) {
        setParticipantId(editingExpense.participantId?.toString() || "");
        setCategory(editingExpense.category);
        setItem(editingExpense.item);
        setAmount(editingExpense.amount.toString());
      } else {
        if (participants.data && participants.data.length > 0) {
          setParticipantId(participants.data[0].id.toString());
        }
        setCategory(categories[0] ?? "Other");
        setItem("");
        setAmount("");
      }
    }
  }, [open, editingExpense, participants.data, categories]);

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
        onSuccess: () => onOpenChange(false)
      });
    } else {
      createExpense.mutate(payload, {
        onSuccess: () => onOpenChange(false)
      });
    }
  };

  const isPending = createExpense.isPending || updateExpense.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DraggableDialogContent className="sm:max-w-md bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display text-accent">
            {editingExpense ? t.modals.editExpenseTitle : t.modals.addExpenseTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">

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
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="bg-secondary/50 border-white/10" data-testid="select-expense-category">
                <SelectValue placeholder={t.modals.categoryLabel} />
              </SelectTrigger>
              <SelectContent className="bg-card border-white/10">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{t.categories[cat as keyof typeof t.categories] ?? cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item" className="uppercase text-xs tracking-wider text-muted-foreground">
              {t.modals.itemLabel}
            </Label>
            <Input
              id="item"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              placeholder="e.g. Ribeye steaks"
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

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {t.modals.cancel}
            </Button>
            <Button
              type="submit"
              disabled={isPending || !participantId || !item.trim() || !amount}
              className="bg-accent text-accent-foreground font-bold w-full sm:w-auto"
              data-testid="button-submit-expense"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingExpense ? t.modals.save : t.modals.add}
            </Button>
          </DialogFooter>
        </form>
      </DraggableDialogContent>
    </Dialog>
  );
}
