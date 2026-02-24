import { Plus } from "lucide-react";
import type { ExpenseTemplateItem } from "@/eventTemplates";

/** @deprecated Use ExpenseTemplateItem from expenseTemplates. Kept for type compatibility. */
export interface RecommendedExpensePreset {
  item: string;
  category: string;
  splitType?: "equal";
  splitMode?: "equal" | "opt-in";
  notes?: string;
  icon?: string;
}

interface RecommendedExpensesProps {
  /** Presets to show as quick-add buttons (from getExpenseTemplates). */
  presets: (ExpenseTemplateItem | RecommendedExpensePreset)[];
  /** Called when user clicks a preset. Opens add-expense flow with pre-filled values. */
  onAddPreset: (preset: { item: string; category: string; optInDefault?: boolean }) => void;
  /** Section heading. Default: "Recommended expenses" */
  title?: string;
  /** Optional helper text below the buttons. */
  helper?: string;
  /** Whether event has opt-in expenses (show splitMode badge on chips). */
  allowOptIn?: boolean;
}

/**
 * Reusable section of quick-add expense presets.
 * Clicking a preset calls onAddPreset; the parent opens the Add Expense dialog
 * with defaultItem and defaultCategory pre-filled. No expense is created until
 * the user submits the form.
 */
export function RecommendedExpenses({
  presets,
  onAddPreset,
  title = "Recommended expenses",
  helper,
  allowOptIn = false,
}: RecommendedExpensesProps) {
  if (presets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => {
          const label = "label" in preset ? preset.label : preset.item;
          const category = preset.category;
          const optInDefault = "optInDefault" in preset
            ? preset.optInDefault
            : (preset as RecommendedExpensePreset).splitMode === "opt-in";
          const icon = "icon" in preset ? preset.icon : (preset as RecommendedExpensePreset).icon;
          const notes = "notes" in preset ? (preset as RecommendedExpensePreset).notes : undefined;
          return (
            <button
              key={`${label}-${category}`}
              type="button"
              onClick={() => onAddPreset({ item: label, category, optInDefault })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-secondary/30 px-3 py-1.5 text-sm hover:bg-accent/20 hover:border-accent/30 transition-colors"
              data-testid={`button-recommended-${label.replace(/\s/g, "-").replace(/\//g, "-").toLowerCase()}`}
            >
              {icon ? <span className="text-base leading-none" aria-hidden>{icon}</span> : <Plus className="w-3.5 h-3.5 text-muted-foreground" />}
              {label}
              {allowOptIn && optInDefault === true && (
                <span className="text-[10px] text-muted-foreground/80" title="Participants opt in">opt-in</span>
              )}
              {notes && (
                <span className="text-[10px] text-muted-foreground/80">({notes})</span>
              )}
            </button>
          );
        })}
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
