import { useState, useEffect, useMemo, useRef } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useCreateExpense, useDeleteExpenseReceipt, useUpdateExpense, useUploadExpenseReceipt } from "@/hooks/use-expenses";
import { useParticipants } from "@/hooks/use-participants";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Plus, Upload, Trash2, ExternalLink, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
  lastExpense?: ExpenseWithParticipant | null;
  privateTone?: boolean;
  showReceipt?: boolean;
}

const DEFAULT_CATEGORIES = ["Meat", "Bread", "Drinks", "Charcoal", "Transportation", "Other"];
const EMPTY_PARTICIPANTS: Array<{ id: number; userId?: string | null; name: string }> = [];

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

export function AddExpenseDialog({ open, onOpenChange, editingExpense, bbqId, currencySymbol, categories: categoriesProp, defaultItem: defaultItemProp, defaultCategory: defaultCategoryProp, defaultOptIn: defaultOptInProp, allowOptIn = false, onAddCustomCategory, eventType, eventKind = "party", currentUsername, currencyCode, groupHomeCurrencyCode, lastExpense, privateTone = false, showReceipt = false }: AddExpenseDialogProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const participants = useParticipants(bbqId);
  const createExpense = useCreateExpense(bbqId);
  const updateExpense = useUpdateExpense(bbqId);
  const uploadReceipt = useUploadExpenseReceipt(bbqId);
  const deleteReceipt = useDeleteExpenseReceipt(bbqId);

  const categories = categoriesProp ?? DEFAULT_CATEGORIES;

  const [participantId, setParticipantId] = useState<string>("");
  const [category, setCategory] = useState<string>(categories[0] ?? "Other");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [splitMode, setSplitMode] = useState<"everyone" | "selected">("everyone");
  const [includedUserIds, setIncludedUserIds] = useState<string[]>([]);
  const [optInByDefault, setOptInByDefault] = useState(false);
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);

  const participantList = useMemo(
    () => ((participants.data ?? EMPTY_PARTICIPANTS) as Array<{ id: number; userId?: string | null; name: string }>),
    [participants.data],
  );
  const resetSignatureRef = useRef<string>("");
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
    if (!open) {
      resetSignatureRef.current = "";
      return;
    }

    const editingSignature = editingExpense
      ? [
        editingExpense.id,
        editingExpense.participantId ?? "",
        editingExpense.category ?? "",
        editingExpense.item ?? "",
        editingExpense.amount ?? "",
        editingExpense.receiptUrl ?? "",
      ].join("|")
      : "new";
    const signature = [
      editingSignature,
      bbqId ?? "",
      participantList.length,
      resolvedDefaults.payerParticipantId ?? "",
      smartStored.defaults?.lastCategory ?? "",
      defaultCategoryProp ?? "",
      defaultItemProp ?? "",
      defaultOptInProp == null ? "" : String(defaultOptInProp),
      categories.join("|"),
    ].join("::");

    if (resetSignatureRef.current === signature) return;
    resetSignatureRef.current = signature;

    setShowCustomCategoryInput(false);
    setCustomCategoryName("");
    if (editingExpense) {
      setParticipantId(editingExpense.participantId?.toString() || "");
      setCategory(editingExpense.category);
      setItem(editingExpense.item);
      setAmount(editingExpense.amount.toString());
      const savedIncluded = parseIncludedUserIds(editingExpense.includedUserIds);
      if (savedIncluded.length > 0) {
        setSplitMode("selected");
        setIncludedUserIds(savedIncluded);
      } else {
        setSplitMode("everyone");
        setIncludedUserIds(participantList.map((participant) => String(participant.id)));
      }
      setOptInByDefault(false);
      setReceiptDataUrl(null);
      setReceiptPreviewUrl(editingExpense.receiptUrl ?? null);
      setRemoveExistingReceipt(false);
      return;
    }

    if (participantList.length > 0) {
      const suggestedPayerId = resolvedDefaults.payerParticipantId ?? participantList[0].id;
      setParticipantId(String(suggestedPayerId));
    }
    const rememberedCategory = smartStored.defaults?.lastCategory;
    const cat = defaultCategoryProp ?? (rememberedCategory && categories.includes(rememberedCategory) ? rememberedCategory : undefined) ?? categories[0] ?? "Other";
    setCategory(categories.includes(cat) ? cat : categories[0] ?? "Other");
    setItem(defaultItemProp ?? "");
    setAmount("");
    setSplitMode("everyone");
    setIncludedUserIds(participantList.map((participant) => String(participant.id)));
    setOptInByDefault(defaultOptInProp ?? false);
    setReceiptDataUrl(null);
    setReceiptPreviewUrl(null);
    setRemoveExistingReceipt(false);
  }, [
    open,
    editingExpense?.id,
    editingExpense?.participantId,
    editingExpense?.category,
    editingExpense?.item,
    editingExpense?.amount,
    editingExpense?.receiptUrl,
    bbqId,
    participantList.length,
    categories,
    defaultItemProp,
    defaultCategoryProp,
    defaultOptInProp,
    resolvedDefaults.payerParticipantId,
    smartStored.defaults?.lastCategory,
  ]);

  const themeId = eventType && eventKind ? (getThemeConfig(eventKind, eventType).id as ThemeId) : null;
  const placeholderKey = themeId != null ? getExpensePlaceholderKey(category, themeId) : getPlaceholderKeyForCategory(category);
  const itemPlaceholder = (t.placeholders as Record<string, string>)[placeholderKey] ?? "e.g. Miscellaneous";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId || !item.trim() || !amount || parseFloat(amount) <= 0) return;
    if (splitMode === "selected" && includedUserIds.length === 0) return;

    const payload = {
      participantId: parseInt(participantId),
      category,
      item: item.trim(),
      amount: amount,
      includedUserIds: splitMode === "selected" ? includedUserIds : null,
    };

    if (editingExpense) {
      try {
        await updateExpense.mutateAsync({ id: editingExpense.id, ...payload });
        if (showReceipt) {
          if (removeExistingReceipt && editingExpense.receiptUrl) {
            await deleteReceipt.mutateAsync(editingExpense.id);
          }
          if (receiptDataUrl) {
            await uploadReceipt.mutateAsync({ expenseId: editingExpense.id, dataUrl: receiptDataUrl });
          }
        }
        // Ensure all cost-dependent UI (expenses, balances, paybacks) updates immediately while drawers stay open.
        if (bbqId) {
          await queryClient.refetchQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'], exact: true });
          await queryClient.refetchQueries({ queryKey: ['/api/barbecues', bbqId, 'expense-shares'], exact: true });
        }
        toast({ variant: "success", message: t.modals.expenseUpdated });
        setSavedPulse(true);
        globalThis.setTimeout(() => setSavedPulse(false), 450);
        onOpenChange(false);
      } catch {
        toast({ variant: "error", message: privateTone ? "Couldn’t save that expense. Please try again." : t.modals.expenseAddFailed });
      }
    } else {
      try {
        const created = await createExpense.mutateAsync(
          allowOptIn ? { ...payload, optInByDefault: optInByDefault } : payload,
        );
        if (showReceipt && receiptDataUrl && created?.id) {
          await uploadReceipt.mutateAsync({ expenseId: created.id, dataUrl: receiptDataUrl });
        }
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
          // Ensure all cost-dependent UI (expenses, balances, paybacks) updates immediately while drawers stay open.
          await queryClient.refetchQueries({ queryKey: ['/api/barbecues', bbqId, 'expenses'], exact: true });
          await queryClient.refetchQueries({ queryKey: ['/api/barbecues', bbqId, 'expense-shares'], exact: true });
        }
        toast({ variant: "success", message: t.modals.expenseAdded });
        setSavedPulse(true);
        globalThis.setTimeout(() => setSavedPulse(false), 450);
        onOpenChange(false);
      } catch {
        toast({ variant: "error", message: privateTone ? "Couldn’t add that expense. Please try again." : t.modals.expenseAddFailed });
      }
    }
  };

  const isPending = createExpense.isPending || updateExpense.isPending || uploadReceipt.isPending || deleteReceipt.isPending;
  const isSplitValid = splitMode === "everyone" || includedUserIds.length > 0;
  const canRepeatLast = !editingExpense && !!lastExpense;

  const onReceiptFileSelected = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "error", message: "Please choose an image file." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "error", message: "Receipt must be 5MB or smaller." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      setReceiptDataUrl(result);
      setReceiptPreviewUrl(result);
      setRemoveExistingReceipt(false);
    };
    reader.readAsDataURL(file);
  };

  const applyRepeatLast = () => {
    if (!lastExpense || editingExpense) return;
    const lastParticipantId = lastExpense.participantId != null ? String(lastExpense.participantId) : "";
    if (lastParticipantId && participantList.some((p) => String(p.id) === lastParticipantId)) {
      setParticipantId(lastParticipantId);
    }
    if (lastExpense.category && categories.includes(lastExpense.category)) {
      setCategory(lastExpense.category);
    }
    setItem(lastExpense.item ?? "");
    setAmount("");
  };

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
          <PremiumPressable asChild disabled={isPending || !participantId || !item.trim() || !amount || !isSplitValid}>
            <Button
              type="submit"
              form="add-expense-form"
              disabled={isPending || !participantId || !item.trim() || !amount || !isSplitValid}
              className={`w-full sm:w-auto min-w-[132px] bg-accent text-accent-foreground font-semibold shadow-lg shadow-accent/20 hover:shadow-accent/30 transition-transform duration-150 ${savedPulse ? "scale-[1.03]" : "scale-100"}`}
              data-testid="button-submit-expense"
            >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : savedPulse ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <span className="inline-block h-4 w-4 mr-2" aria-hidden />
            )}
            {isPending ? "Saving..." : savedPulse ? "Saved" : (editingExpense ? t.modals.save : t.modals.add)}
          </Button>
          </PremiumPressable>
        </>
      }
      data-testid="modal-add-expense"
    >
      <form id="add-expense-form" onSubmit={handleSubmit} className="space-y-4">
        {canRepeatLast ? (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={applyRepeatLast}
              data-testid="button-repeat-last-expense"
            >
              {privateTone ? "Use last expense" : "Repeat last"}
            </Button>
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="participant" className="uppercase text-xs tracking-wider text-muted-foreground">
              {t.modals.paidByLabel}
            </Label>
            {!editingExpense && resolvedDefaults.payerSuggestionSource !== "fallback" ? (
              <span className="text-xs text-muted-foreground">
                {resolvedDefaults.payerSuggestionSource === "lastUsed"
                  ? (privateTone ? "Last used here" : "Last used")
                  : (privateTone ? "Suggested for this circle" : "Suggested")}
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
          <Label className="uppercase text-xs tracking-wider text-muted-foreground">Split</Label>
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-secondary/30 p-1">
            <Button
              type="button"
              size="sm"
              variant={splitMode === "everyone" ? "default" : "ghost"}
              className="h-8 rounded-md px-3"
              onClick={() => setSplitMode("everyone")}
            >
              Everyone
            </Button>
            <Button
              type="button"
              size="sm"
              variant={splitMode === "selected" ? "default" : "ghost"}
              className="h-8 rounded-md px-3"
              onClick={() => {
                setSplitMode("selected");
                if (includedUserIds.length === 0) {
                  setIncludedUserIds(orderedParticipants.map((participant: any) => String(participant.id)));
                }
              }}
            >
              Select people
            </Button>
          </div>
          {splitMode === "selected" ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
              <p className="mb-2 text-xs text-muted-foreground">Included: {includedUserIds.length} people</p>
              <div className="space-y-1.5">
                {orderedParticipants.map((participant: any) => {
                  const value = String(participant.id);
                  const checked = includedUserIds.includes(value);
                  return (
                    <label key={`expense-share-${participant.id}`} className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-background/70">
                      <span className="text-sm">{participant.name}</span>
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
              {!isSplitValid ? (
                <p className="mt-2 text-xs text-destructive">Select at least one person.</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Included: Everyone</p>
          )}
        </div>

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

        {showReceipt && (
          <div className="space-y-2">
            <Label className="uppercase text-xs tracking-wider text-muted-foreground">Receipt</Label>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
              {receiptPreviewUrl ? (
                <div className="flex items-center gap-3">
                  <img src={receiptPreviewUrl} alt="Receipt preview" className="h-16 w-16 rounded-lg object-cover border border-border/60" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => window.open(receiptPreviewUrl, "_blank", "noopener,noreferrer")}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      View
                    </Button>
                    <Label className="inline-flex">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => onReceiptFileSelected(e.currentTarget.files?.[0] ?? null)}
                      />
                      <Button type="button" size="sm" variant="outline" asChild>
                        <span>
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                          Replace
                        </span>
                      </Button>
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setReceiptDataUrl(null);
                        setReceiptPreviewUrl(null);
                        setRemoveExistingReceipt(!!editingExpense?.receiptUrl);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Label className="inline-flex">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onReceiptFileSelected(e.currentTarget.files?.[0] ?? null)}
                  />
                  <Button type="button" size="sm" variant="outline" asChild>
                    <span>
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      Upload receipt
                    </span>
                  </Button>
                </Label>
              )}
              <p className="text-xs text-muted-foreground">Optional. JPG, PNG, WEBP or GIF up to 5MB.</p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
