import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMainTypeIcon, getSubTypeIcon } from "@/lib/planIcons";
import {
  derivePlanTypeSelection,
  getPlanMainTypeLabel,
  PLAN_MAIN_TYPE_OPTIONS,
  PLAN_SUBCATEGORIES_BY_MAIN,
  type PlanMainType,
  type PlanSubcategoryId,
} from "@shared/lib/plan-types";

type PlanTypeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    name: string;
    eventType?: string | null;
    templateData?: unknown;
  } | null;
  saving?: boolean;
  onSave: (updates: { mainType: PlanMainType; subcategory: PlanSubcategoryId | null }) => Promise<void>;
};

export default function PlanTypeDrawer({ open, onOpenChange, plan, saving = false, onSave }: PlanTypeDrawerProps) {
  const [mainType, setMainType] = useState<PlanMainType | null>(null);
  const [subcategory, setSubcategory] = useState<PlanSubcategoryId | null>(null);
  const [touched, setTouched] = useState(false);

  const initialSelection = useMemo(
    () => derivePlanTypeSelection({ templateData: plan?.templateData, eventType: plan?.eventType }),
    [plan?.eventType, plan?.templateData],
  );

  useEffect(() => {
    if (!open) return;
    setMainType(initialSelection.mainType);
    setSubcategory(initialSelection.subcategory);
    setTouched(false);
  }, [open, initialSelection.mainType, initialSelection.subcategory]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const section = document.getElementById("plan-type-section");
      if (!section) return;
      section.scrollIntoView({ block: "start", behavior: "smooth" });
      const firstControl = section.querySelector("button");
      if (firstControl instanceof HTMLButtonElement) {
        firstControl.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const subcategories = useMemo(
    () => (mainType ? PLAN_SUBCATEGORIES_BY_MAIN[mainType] : []),
    [mainType],
  );
  const subcategoryValid = !subcategory || !mainType || subcategories.some((item) => item.id === subcategory);
  const isDirty = mainType !== initialSelection.mainType || subcategory !== initialSelection.subcategory;

  const canSave = !!mainType && subcategoryValid && isDirty && !saving;

  const handleMainTypeSelect = (value: PlanMainType) => {
    setMainType(value);
    if (subcategory) {
      const stillValid = PLAN_SUBCATEGORIES_BY_MAIN[value].some((item) => item.id === subcategory);
      if (!stillValid) setSubcategory(null);
    }
  };

  const handleSave = async () => {
    setTouched(true);
    if (!mainType || !subcategoryValid || saving || !isDirty) return;
    await onSave({ mainType, subcategory: subcategory ?? null });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
      >
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Plan type</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
                Choose what kind of plan this is.
              </SheetDescription>
            </SheetHeader>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="space-y-5">
              <section id="plan-type-section" className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">Main type</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PLAN_MAIN_TYPE_OPTIONS.map((option) => {
                    const active = mainType === option.id;
                    const Icon = getMainTypeIcon(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleMainTypeSelect(option.id)}
                        className={`rounded-2xl border p-4 text-left transition-all duration-150 ${
                          active
                            ? "border-primary/70 bg-primary/10 shadow-sm"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-900/70"
                        }`}
                      >
                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-neutral-100">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-neutral-400">
                  {mainType ? `${getPlanMainTypeLabel(mainType)} type` : "Subcategory"}
                </p>
                {mainType ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {subcategories.map((item) => {
                      const Icon = getSubTypeIcon(mainType, item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSubcategory(item.id)}
                          className={`rounded-xl border px-3 py-2 text-left text-sm transition-all duration-150 ${
                            subcategory === item.id
                              ? "border-primary/70 bg-primary/10 text-slate-900 dark:text-neutral-100"
                              : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900/70"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Pick a main type first.</p>
                )}
                {touched && !subcategoryValid ? (
                  <p className="text-xs text-destructive">Subcategory must match the selected main type.</p>
                ) : null}
              </section>
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={!canSave}>
                Save changes
              </Button>
            </div>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}
