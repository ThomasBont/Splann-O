"use client";

import { getEventTheme } from "@/theme/useEventTheme";
import { useLanguage } from "@/hooks/use-language";
import type { EventCategory } from "@/theme/eventThemes";
import { cnTheme } from "@/theme/eventThemes";
import { EventCategoryBadge } from "@/components/event/EventCategoryBadge";
import { getEventTheme as getCategoryTheme, getEventThemeStyle, type EventThemeCategory } from "@/lib/eventTheme";
import type { EventHeaderPreferences, UtilityAction } from "@/lib/event-header-preferences";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Link2, MessageCircle, Settings, ChevronDown, CalendarPlus, MoreHorizontal, MapPin } from "lucide-react";
import { UI_COPY } from "@/lib/emotional-copy";

export interface EventHeaderProps {
  category: EventCategory;
  type: string;
  title: string;
  /** Formatted date string, optional */
  dateStr?: string;
  /** Location display e.g. "Amsterdam, Netherlands" */
  locationDisplay?: string | null;
  onAddExpense: () => void;
  addExpenseLabel?: string;
  /** Creator-only */
  isCreator?: boolean;
  onOpenSettings?: () => void;
  onShare?: () => void;
  onShareWhatsApp?: () => void;
  onCreateWhatsAppGroup?: () => void;
  onAddToCalendar?: () => void;
  onOpenInMaps?: () => void;
  shareLabel?: string;
  shareWhatsAppLabel?: string;
  createWhatsAppGroupLabel?: string;
  utilityPreferences?: EventHeaderPreferences;
  /** Event status for pill */
  eventStatus?: "draft" | "active" | "closed" | "settled" | "archived";
  showStatusPill?: boolean;
  themeCategoryKey?: EventThemeCategory | string | null;
  showAddExpenseAction?: boolean;
}

function StatusPill({ status }: { status: "draft" | "active" | "closed" | "settled" | "archived" }) {
  const { t } = useLanguage();
  const config = {
    draft: { label: t.settleUp?.statusDraft ?? "Draft", class: "bg-muted text-muted-foreground" },
    active: { label: t.settleUp?.statusActive ?? "Active", class: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
    closed: { label: "Closed", class: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    settled: { label: t.settleUp?.statusSettled ?? "All settled", class: "bg-green-500/15 text-green-600 dark:text-green-400" },
    archived: { label: "Archived", class: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
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
  onAddExpense,
  addExpenseLabel = UI_COPY.actions.addExpense,
  isCreator,
  onOpenSettings,
  onShare,
  onShareWhatsApp,
  onCreateWhatsAppGroup,
  onAddToCalendar,
  onOpenInMaps,
  shareLabel = UI_COPY.actions.share,
  shareWhatsAppLabel = "Share to WhatsApp",
  createWhatsAppGroupLabel = "Create WhatsApp group",
  utilityPreferences,
  eventStatus = "active",
  showStatusPill = true,
  themeCategoryKey,
  showAddExpenseAction = true,
}: EventHeaderProps) {
  const { t } = useLanguage();
  const theme = getEventTheme(category, type);
  const categoryTheme = getCategoryTheme(themeCategoryKey);
  const eventTypeLabel = (t.eventTypes as Record<string, string>)[theme.labelKey] ?? theme.label;

  const subtitleParts = [eventTypeLabel];
  if (dateStr) subtitleParts.push(dateStr);
  if (locationDisplay) subtitleParts.push(locationDisplay);
  const baseOrder: UtilityAction[] = utilityPreferences?.utilityOrder?.length
    ? utilityPreferences.utilityOrder
    : ["share", "calendar", "settings"];
  const utilityActions: UtilityAction[] = baseOrder.filter((action, idx, arr) => arr.indexOf(action) === idx);
  const hidden = utilityPreferences?.utilityHidden ?? {};

  return (
    <div
      style={getEventThemeStyle(themeCategoryKey)}
      className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--border-subtle))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-sm)] ${categoryTheme.classes.surface}`}
    >
      {/* Theme strip - subtle accent */}
      <div
        className={cnTheme(theme, "strip") + " h-0.5 w-full opacity-50"}
        aria-hidden
      />
      <div className="px-3 py-2.5 sm:px-5 sm:py-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Left: theme badge + title + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2.5 sm:items-center sm:gap-3">
              {/* Theme badge — accent at ~10–15% opacity */}
              <div
                className={cnTheme(theme, "badge") + " flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-base transition-smooth sm:h-9 sm:w-9 sm:text-lg"}
                aria-hidden
              >
                {theme.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="truncate text-[15px] font-semibold text-foreground sm:text-lg">
                    {title}
                  </h1>
                  <EventCategoryBadge category={themeCategoryKey} compact />
                  {showStatusPill && <StatusPill status={eventStatus} />}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground sm:line-clamp-1 sm:text-xs">
                  {subtitleParts.join(" · ")}
                </p>
                {locationDisplay && onOpenInMaps && (
                  <div className="mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-[26px] px-2 text-[10px] sm:h-7 sm:text-[11px]"
                      onClick={onOpenInMaps}
                      aria-label="Open location in Maps"
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1.5" />
                      Open in Maps
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Right: primary actions + overflow */}
          <div className="flex items-center gap-1.5 md:hidden md:flex-shrink-0 md:flex-wrap">
            {showAddExpenseAction && (
              <Button
                size="sm"
                onClick={onAddExpense}
                className="btn-interact h-[30px] bg-primary px-3 text-[11px] font-medium text-primary-foreground"
                data-testid="button-add-expense-header-mobile"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {addExpenseLabel}
              </Button>
            )}
            {onShare && (
              <Button
                size="sm"
                variant="outline"
                className="h-[30px] px-2.5 text-[11px]"
                onClick={onShare}
              >
                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                Share
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-[30px] w-[30px] p-0" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {!showAddExpenseAction && (
                  <DropdownMenuItem onSelect={onAddExpense}>
                    <Plus className="w-4 h-4 mr-2" />
                    {addExpenseLabel}
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem onSelect={onShare}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Copy link
                  </DropdownMenuItem>
                )}
                {onShareWhatsApp && (
                  <DropdownMenuItem onSelect={onShareWhatsApp}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {shareWhatsAppLabel}
                  </DropdownMenuItem>
                )}
                {onCreateWhatsAppGroup && (
                  <DropdownMenuItem onSelect={onCreateWhatsAppGroup}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {createWhatsAppGroupLabel}
                  </DropdownMenuItem>
                )}
                {onAddToCalendar && (
                  <DropdownMenuItem onSelect={onAddToCalendar}>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    {UI_COPY.actions.addToCalendar}
                  </DropdownMenuItem>
                )}
                {isCreator && onOpenSettings && (
                  <DropdownMenuItem onSelect={onOpenSettings}>
                    <Settings className="w-4 h-4 mr-2" />
                    {UI_COPY.actions.settings}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="hidden md:flex items-center gap-3 flex-nowrap flex-shrink-0 min-w-0 justify-end min-h-10">
            <div className="flex items-center shrink-0 min-h-10">
              {showAddExpenseAction && (
                <Button
                  size="md"
                  onClick={onAddExpense}
                  variant="primary"
                  className="btn-interact h-10 min-w-[152px] text-sm font-semibold px-4 justify-center"
                  data-testid="button-add-expense-header"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {addExpenseLabel}
                </Button>
              )}
            </div>
            <TooltipProvider delayDuration={200}>
            <div className="flex items-center flex-nowrap gap-1 shrink-0 rounded-lg border border-border/60 bg-muted/15 px-1.5 py-1 min-h-10 min-w-[128px]">
              {utilityActions.map((action) => {
                if (hidden[action]) return null;
                if (action === "share" && onShare) {
                  if (onShareWhatsApp || onCreateWhatsAppGroup) {
                    return (
                      <DropdownMenu key="utility-share">
                        <Tooltip>
                          <DropdownMenuTrigger asChild>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 md:h-10 lg:h-8 text-[11px] px-2 md:w-10 md:px-0 lg:w-auto lg:px-2"
                                aria-label={shareLabel}
                                title={shareLabel}
                              >
                                <Link2 className="w-3.5 h-3.5 md:mr-0 lg:mr-1" />
                                <span className="hidden lg:inline">{shareLabel}</span>
                                <ChevronDown className="hidden lg:inline w-3.5 h-3.5 ml-1" />
                              </Button>
                            </TooltipTrigger>
                          </DropdownMenuTrigger>
                          <TooltipContent side="bottom" className="lg:hidden">{shareLabel}</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onSelect={onShare}>
                            <Link2 className="w-4 h-4 mr-2" />
                            Copy link
                          </DropdownMenuItem>
                          {onShareWhatsApp && (
                            <DropdownMenuItem onSelect={onShareWhatsApp}>
                              <MessageCircle className="w-4 h-4 mr-2" />
                              {shareWhatsAppLabel}
                            </DropdownMenuItem>
                          )}
                          {onCreateWhatsAppGroup && (
                            <DropdownMenuItem onSelect={onCreateWhatsAppGroup}>
                              <MessageCircle className="w-4 h-4 mr-2" />
                              {createWhatsAppGroupLabel}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    );
                  }
                  return (
                    <Tooltip key="utility-share">
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 md:h-10 lg:h-8 text-[11px] px-2 md:w-10 md:px-0 lg:w-auto lg:px-2"
                          onClick={onShare}
                          aria-label={shareLabel}
                          title={shareLabel}
                        >
                          <Link2 className="w-3.5 h-3.5 md:mr-0 lg:mr-1" />
                          <span className="hidden lg:inline">{shareLabel}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="lg:hidden">{shareLabel}</TooltipContent>
                    </Tooltip>
                  );
                }
                if (action === "calendar" && onAddToCalendar) {
                  return (
                    <Tooltip key="utility-calendar">
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 md:h-10 lg:h-8 text-[11px] px-2 md:w-10 md:px-0 lg:w-auto lg:px-2"
                          onClick={onAddToCalendar}
                          aria-label={UI_COPY.actions.addToCalendar}
                          title={UI_COPY.actions.addToCalendar}
                        >
                          <CalendarPlus className="w-3.5 h-3.5 md:mr-0 lg:mr-1" />
                          <span className="hidden lg:inline">{UI_COPY.actions.addToCalendar}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="lg:hidden">{UI_COPY.actions.addToCalendar}</TooltipContent>
                    </Tooltip>
                  );
                }
                if (action === "settings" && isCreator && onOpenSettings) {
                  return (
                    <Tooltip key="utility-settings">
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 md:h-10 lg:h-8 text-[11px] px-2 md:w-10 md:px-0 lg:w-auto lg:px-2"
                          onClick={onOpenSettings}
                          aria-label={UI_COPY.actions.settings}
                          title={UI_COPY.actions.settings}
                        >
                          <Settings className="w-3.5 h-3.5 md:mr-0 lg:mr-1" />
                          <span className="hidden lg:inline">{UI_COPY.actions.settings}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="lg:hidden">{UI_COPY.actions.settings}</TooltipContent>
                    </Tooltip>
                  );
                }
                return null;
              })}
            </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
