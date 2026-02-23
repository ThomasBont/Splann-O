import { Plus } from "lucide-react";

export interface RecommendedExpensePreset {
  item: string;
  category: string;
  splitType?: "equal";
  notes?: string;
}

interface RecommendedExpensesProps {
  /** Presets to show as quick-add buttons. */
  presets: RecommendedExpensePreset[];
  /** Called when user clicks a preset. Opens add-expense flow with pre-filled values. */
  onAddPreset: (preset: { item: string; category: string }) => void;
  /** Section heading. Default: "Recommended expenses" */
  title?: string;
  /** Optional helper text below the buttons. */
  helper?: string;
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
}: RecommendedExpensesProps) {
  if (presets.length === 0) return null;

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={`${preset.item}-${preset.category}`}
            type="button"
            onClick={() => onAddPreset({ item: preset.item, category: preset.category })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-secondary/30 px-3 py-1.5 text-sm hover:bg-accent/20 hover:border-accent/30 transition-colors"
            data-testid={`button-recommended-${preset.item.replace(/\s/g, "-").replace(/\//g, "-").toLowerCase()}`}
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
            {preset.item}
            {preset.notes && (
              <span className="text-[10px] text-muted-foreground/80">({preset.notes})</span>
            )}
          </button>
        ))}
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}
