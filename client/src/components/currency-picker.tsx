"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type Currency,
  CoreCurrencies,
  AllCurrencies,
  getCurrencyLabelShort,
  getCurrency,
  findCurrency,
} from "@/lib/currencies";

const STORAGE_FAVORITES = "splanno-currency-favorites";
const STORAGE_RECENTS = "splanno-currency-recents";
const MAX_RECENTS = 3;

function getFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setFavorites(codes: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_FAVORITES, JSON.stringify(codes));
  } catch {}
}

function getRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_RECENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(code: string) {
  if (typeof window === "undefined") return;
  try {
    const prev = getRecents().filter((c) => c !== code);
    const next = [code, ...prev].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_RECENTS, JSON.stringify(next));
  } catch {}
}

/** Stable currency item layout: star | symbol+code | name (truncated, tooltip) */
function CurrencyPickerItem({
  currency,
  isSelected,
  isFavorite,
  onSelect,
  onToggleFavorite,
  showFavorite,
}: {
  currency: Currency;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onToggleFavorite?: (e: React.MouseEvent) => void;
  showFavorite: boolean;
}) {
  const shortLabel = getCurrencyLabelShort(currency);
  const fullLabel = `${currency.symbol} ${currency.code} — ${currency.name}`;
  return (
    <CommandItem
      value={currency.code}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 min-h-[44px] py-0 pr-2",
        "rounded-md px-3 cursor-pointer"
      )}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {showFavorite ? (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="shrink-0 p-1 rounded hover:bg-muted -ml-1"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={cn("h-4 w-4", isFavorite && "fill-amber-400 text-amber-500")} />
          </button>
        ) : (
          <span className="w-6 shrink-0" aria-hidden />
        )}
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {shortLabel}
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                {currency.name}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px]">
              {fullLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
    </CommandItem>
  );
}

export interface CurrencyPickerProps {
  value: string;
  onChange: (code: string) => void;
  /** Use profile favorites when in app mode */
  profileFavorites?: string[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  /** Compact trigger (e.g. for header) */
  compact?: boolean;
  /** For testing */
  "data-testid"?: string;
}

export function CurrencyPicker({
  value,
  onChange,
  profileFavorites = [],
  placeholder = "Select currency",
  className,
  triggerClassName,
  compact = false,
  "data-testid": dataTestId,
}: CurrencyPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [localFavorites, setLocalFavorites] = React.useState<string[]>(() =>
    typeof window !== "undefined" ? getFavorites() : []
  );

  const favorites = profileFavorites.length > 0 ? profileFavorites : localFavorites;
  const recents = getRecents();

  const selected = getCurrency(value);
  const displayLabel = selected ? getCurrencyLabelShort(selected) : placeholder;

  const handleSelect = (code: string) => {
    onChange(code);
    pushRecent(code);
    setOpen(false);
    setSearch("");
  };

  const toggleFavorite = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    if (profileFavorites.length > 0) return;
    const next = favorites.includes(code)
      ? favorites.filter((c) => c !== code)
      : [...favorites, code];
    setLocalFavorites(next);
    setFavorites(next);
  };

  const searchResults = search.trim() ? findCurrency(search) : [];
  const showSearchResults = search.trim().length > 0;
  const coreCodes = new Set(CoreCurrencies.map((c) => c.code));
  const otherCurrencies = AllCurrencies.filter((c) => !coreCodes.has(c.code));
  const [showAll, setShowAll] = React.useState(false);

  const favoritesList = favorites
    .map((code) => getCurrency(code))
    .filter((c): c is Currency => !!c);
  const recentsList = recents
    .filter((c) => c !== value && !favorites.includes(c))
    .map((code) => getCurrency(code))
    .filter((c): c is Currency => !!c);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select currency"
          data-testid={dataTestId}
          className={cn(
            "flex items-center justify-between gap-2 shrink-0 rounded-md border border-input bg-background text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            compact ? "h-8 px-2.5 min-w-[5rem]" : "h-10 px-3 min-w-[10rem]",
            triggerClassName
          )}
        >
          <span className="truncate min-w-0">{displayLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0 overflow-hidden z-[100]",
          "min-w-[260px] w-[max(var(--radix-popover-trigger-width),260px)]",
          className
        )}
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="rounded-lg border-0">
          <div className="px-3 pt-3 pb-2 border-b">
            <CommandInput
              placeholder="Search by code, name, or symbol..."
              value={search}
              onValueChange={setSearch}
              className="h-9 px-3"
            />
          </div>
          <CommandList className="max-h-[300px] [&_[cmdk-group]]:px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
            <CommandEmpty>No currency found.</CommandEmpty>

            {showSearchResults ? (
              <CommandGroup heading="Results">
                {searchResults.slice(0, 50).map((cur) => (
                  <CurrencyPickerItem
                    key={cur.code}
                    currency={cur}
                    isSelected={value === cur.code}
                    isFavorite={favorites.includes(cur.code)}
                    onSelect={() => handleSelect(cur.code)}
                    onToggleFavorite={profileFavorites.length === 0 ? (e) => toggleFavorite(e, cur.code) : undefined}
                    showFavorite={profileFavorites.length === 0}
                  />
                ))}
              </CommandGroup>
            ) : (
              <>
                {favoritesList.length > 0 && (
                  <CommandGroup heading="Favorites">
                    {favoritesList.map((cur) => (
                      <CurrencyPickerItem
                        key={cur.code}
                        currency={cur}
                        isSelected={value === cur.code}
                        isFavorite={true}
                        onSelect={() => handleSelect(cur.code)}
                        onToggleFavorite={(e) => toggleFavorite(e, cur.code)}
                        showFavorite={profileFavorites.length === 0}
                      />
                    ))}
                  </CommandGroup>
                )}
                {recentsList.length > 0 && (
                  <CommandGroup heading="Recent">
                    {recentsList.map((cur) => (
                      <CurrencyPickerItem
                        key={cur.code}
                        currency={cur}
                        isSelected={value === cur.code}
                        isFavorite={favorites.includes(cur.code)}
                        onSelect={() => handleSelect(cur.code)}
                        onToggleFavorite={profileFavorites.length === 0 ? (e) => toggleFavorite(e, cur.code) : undefined}
                        showFavorite={false}
                      />
                    ))}
                  </CommandGroup>
                )}
                <CommandGroup heading="Common">
                  {CoreCurrencies.map((cur) => (
                    <CurrencyPickerItem
                      key={cur.code}
                      currency={cur}
                      isSelected={value === cur.code}
                      isFavorite={favorites.includes(cur.code)}
                      onSelect={() => handleSelect(cur.code)}
                      onToggleFavorite={profileFavorites.length === 0 ? (e) => toggleFavorite(e, cur.code) : undefined}
                      showFavorite={profileFavorites.length === 0}
                    />
                  ))}
                </CommandGroup>
                <CommandGroup heading="All currencies">
                  {(showAll ? otherCurrencies : otherCurrencies.slice(0, 20)).map((cur) => (
                    <CurrencyPickerItem
                      key={cur.code}
                      currency={cur}
                      isSelected={value === cur.code}
                      isFavorite={favorites.includes(cur.code)}
                      onSelect={() => handleSelect(cur.code)}
                      onToggleFavorite={profileFavorites.length === 0 ? (e) => toggleFavorite(e, cur.code) : undefined}
                      showFavorite={false}
                    />
                  ))}
                  {!showAll && otherCurrencies.length > 20 && (
                    <CommandItem
                      onSelect={() => setShowAll(true)}
                      className="text-muted-foreground min-h-[44px]"
                    >
                      Show all {otherCurrencies.length} currencies…
                    </CommandItem>
                  )}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
