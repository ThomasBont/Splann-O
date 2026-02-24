"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ThemeToken } from "@/theme/eventThemes";
import { EventChip } from "@/components/event/EventChip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExpenseTemplateItem } from "@/eventTemplates";

const VISIBLE_COUNT = 5;

export interface QuickAddChipsProps {
  presets: ExpenseTemplateItem[];
  onAdd: (preset: { item: string; category: string }) => void;
  /** Show "opt-in" badge on chips when event has opt-in */
  allowOptIn?: boolean;
  /** Optional theme token for subtle hover accent */
  theme?: ThemeToken;
}

/**
 * Premium quick-add chip row: up to 5 chips + More dropdown.
 */
export function QuickAddChips({
  presets,
  onAdd,
  allowOptIn = false,
  theme,
}: QuickAddChipsProps) {
  const [open, setOpen] = useState(false);
  if (presets.length === 0) return null;

  const visible = presets.slice(0, VISIBLE_COUNT);
  const more = presets.slice(VISIBLE_COUNT);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((p) => (
        <EventChip
          key={`${p.label}-${p.category}`}
          icon={p.icon}
          accentHover={!!theme}
          onClick={() => onAdd({ item: p.label, category: p.category })}
          data-testid={`chip-quickadd-${p.label.replace(/\s/g, "-").toLowerCase()}`}
        >
          {p.label}
          {allowOptIn && p.splitMode === "opt-in" && (
            <span className="text-[9px] text-muted-foreground ml-0.5">opt-in</span>
          )}
        </EventChip>
      ))}
      {more.length > 0 && (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <EventChip
              accentHover={!!theme}
              data-testid="chip-quickadd-more"
              className="gap-0.5"
            >
              <ChevronDown className="w-3 h-3" />
              More
            </EventChip>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
            {more.map((p) => (
              <DropdownMenuItem
                key={`${p.label}-${p.category}`}
                onClick={() => {
                  onAdd({ item: p.label, category: p.category });
                  setOpen(false);
                }}
                className="flex items-center gap-2"
              >
                {p.icon && <span aria-hidden>{p.icon}</span>}
                {p.label}
                {allowOptIn && p.splitMode === "opt-in" && (
                  <span className="text-[10px] text-muted-foreground">opt-in</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
