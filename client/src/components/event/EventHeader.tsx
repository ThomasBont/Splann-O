"use client";

import { getEventTheme } from "@/theme/useEventTheme";
import { useLanguage } from "@/hooks/use-language";
import type { EventCategory } from "@/theme/eventThemes";
import { cnTheme } from "@/theme/eventThemes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CurrencyPicker } from "@/components/currency-picker";
import { Plus, MoreHorizontal, Link2, Sparkles, MapPin } from "lucide-react";

export interface EventHeaderProps {
  category: EventCategory;
  type: string;
  title: string;
  /** Formatted date string, optional */
  dateStr?: string;
  /** Location display e.g. "Amsterdam, Netherlands" */
  locationDisplay?: string | null;
  /** Currency symbol for display (e.g. in stats) */
  currencySymbol: string;
  displayCurrency: string;
  onCurrencyChange: (value: string) => void;
  /** Profile favorites for currency picker (optional) */
  profileFavorites?: string[];
  onAddExpense: () => void;
  addExpenseLabel?: string;
  /** Creator-only: opt-in toggle + delete */
  isCreator?: boolean;
  allowOptIn?: boolean;
  onOptInChange?: (checked: boolean) => void;
  optInPending?: boolean;
  onDelete?: () => void;
  /** Optional: invite link for "Copy invite link" in dropdown */
  inviteLinkUrl?: string;
  onCopyInviteLink?: () => void;
  /** Optional: edit trip location (trips only) */
  onEditLocation?: () => void;
  /** Event status for pill + Settle up CTA */
  eventStatus?: "draft" | "active" | "settling" | "settled";
  onSettleUp?: () => void;
  settleUpPending?: boolean;
}

function StatusPill({ status }: { status: "draft" | "active" | "settling" | "settled" }) {
  const { t } = useLanguage();
  const config = {
    draft: { label: t.settleUp?.statusDraft ?? "Draft", class: "bg-muted text-muted-foreground" },
    active: { label: t.settleUp?.statusActive ?? "Active", class: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    settling: { label: t.settleUp?.statusSettling ?? "Settling up", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    settled: { label: t.settleUp?.statusSettled ?? "All settled", class: "bg-green-500/15 text-green-600 dark:text-green-400" },
  };
  const c = config[status] ?? config.active;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${c.class}`}>
      {c.label}
    </span>
  );
}

/**
 * Compact event header: icon + name + subtitle, currency + Add Expense + overflow.
 * Theme-tinted strip at top.
 */
export function EventHeader({
  category,
  type,
  title,
  dateStr,
  locationDisplay,
  currencySymbol,
  displayCurrency,
  onCurrencyChange,
  profileFavorites,
  onAddExpense,
  addExpenseLabel = "Add Expense",
  isCreator,
  allowOptIn,
  onOptInChange,
  optInPending,
  onDelete,
  inviteLinkUrl,
  onCopyInviteLink,
  onEditLocation,
  eventStatus = "active",
  onSettleUp,
  settleUpPending,
}: EventHeaderProps) {
  const { t } = useLanguage();
  const theme = getEventTheme(category, type);
  const eventTypeLabel = (t.eventTypes as Record<string, string>)[theme.labelKey] ?? theme.label;

  const subtitleParts = [eventTypeLabel];
  if (dateStr) subtitleParts.push(dateStr);
  if (locationDisplay) subtitleParts.push(locationDisplay);

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-sm)]">
      {/* Theme strip - subtle accent */}
      <div
        className={cnTheme(theme, "strip") + " h-0.5 w-full opacity-50"}
        aria-hidden
      />
      <div className="px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: theme badge + title + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {/* Theme badge — accent at ~10–15% opacity */}
              <div
                className={cnTheme(theme, "badge") + " flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-lg transition-smooth"}
                aria-hidden
              >
                {theme.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
                    {title}
                  </h1>
                  <StatusPill status={eventStatus} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subtitleParts.join(" · ")}
                </p>
              </div>
            </div>
          </div>
          {/* Right: currency + Settle up + Add Expense + overflow */}
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {isCreator && onSettleUp && eventStatus !== "settling" && eventStatus !== "settled" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onSettleUp}
                disabled={settleUpPending}
                className="h-8 text-xs font-medium"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {t.settleUp?.ctaShort ?? "Settle up"}
              </Button>
            )}
            <CurrencyPicker
              value={displayCurrency}
              onChange={onCurrencyChange}
              profileFavorites={profileFavorites}
              compact
              triggerClassName="h-8 text-xs"
              data-testid="select-display-currency"
            />
            <Button
              size="sm"
              onClick={onAddExpense}
              className="btn-interact h-8 bg-primary text-primary-foreground text-xs font-medium px-3"
              data-testid="button-add-expense-header"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              {addExpenseLabel}
            </Button>
            {isCreator && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="w-7 h-7">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {onEditLocation && (
                    <DropdownMenuItem onClick={onEditLocation}>
                      <MapPin className="w-4 h-4 mr-2" />
                      Edit location
                    </DropdownMenuItem>
                  )}
                  {inviteLinkUrl && onCopyInviteLink && import.meta.env.VITE_ENABLE_SHARING !== "false" && (
                    <DropdownMenuItem onClick={onCopyInviteLink}>
                      <Link2 className="w-4 h-4 mr-2" />
                      Copy invite link
                    </DropdownMenuItem>
                  )}
                  {onOptInChange && (
                    <DropdownMenuItem asChild>
                      <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={!!allowOptIn}
                          onChange={(e) => onOptInChange(e.target.checked)}
                          disabled={optInPending}
                          className="rounded border-input"
                        />
                        <span>Allow opt-in expenses</span>
                        {optInPending && <span className="text-xs text-muted-foreground">(saving…)</span>}
                      </label>
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive focus:text-destructive"
                    >
                      Delete event
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
