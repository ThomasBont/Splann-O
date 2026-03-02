"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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

const STORAGE_RECENTS = "splanno-currency-recents";
const MAX_RECENTS = 5;

function getRecents(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(storageKey: string, code: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const prev = getRecents(storageKey).filter((c) => c !== code);
    const next = [code, ...prev].slice(0, MAX_RECENTS);
    localStorage.setItem(storageKey, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

function recentsStorageKey(userScopedKey?: string) {
  return userScopedKey ? `${STORAGE_RECENTS}:${userScopedKey}` : STORAGE_RECENTS;
}

/** Stable currency item layout: star | symbol+code | name (truncated, tooltip) */
function CurrencyPickerItem({
  currency,
  isSelected,
  onSelect,
  note,
}: {
  currency: Currency;
  isSelected: boolean;
  onSelect: () => void;
  note?: string;
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
        <span className="shrink-0 font-medium tabular-nums text-foreground">
          {shortLabel}
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="min-w-0 flex-1">
                <span className="truncate text-muted-foreground text-sm block">
                  {currency.name}
                </span>
                {note && <span className="truncate text-[11px] text-muted-foreground/80 block">{note}</span>}
              </div>
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
  /** @deprecated Kept for compatibility; favorites are no longer shown in the picker UI. */
  profileFavorites?: string[];
  suggestedCode?: string | null;
  suggestedNote?: string | null;
  recentStorageUserKey?: string;
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
  profileFavorites: _profileFavorites,
  suggestedCode,
  suggestedNote,
  recentStorageUserKey,
  placeholder = "Select currency",
  className,
  triggerClassName,
  compact = false,
  "data-testid": dataTestId,
}: CurrencyPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const storageKey = React.useMemo(() => recentsStorageKey(recentStorageUserKey), [recentStorageUserKey]);
  const [recentCodes, setRecentCodes] = React.useState<string[]>(() =>
    typeof window !== "undefined" ? getRecents(recentsStorageKey(recentStorageUserKey)) : []
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setRecentCodes(getRecents(storageKey));
  }, [storageKey]);

  const selected = getCurrency(value);
  const displayLabel = selected ? getCurrencyLabelShort(selected) : placeholder;

  const handleSelect = (code: string) => {
    onChange(code);
    setRecentCodes(pushRecent(storageKey, code));
    setOpen(false);
    setSearch("");
  };

  const normalizedSearch = search.trim();
  const [showAll, setShowAll] = React.useState(false);
  React.useEffect(() => {
    if (normalizedSearch) setShowAll(true);
    else setShowAll(false);
  }, [normalizedSearch]);

  const suggestedCurrency = suggestedCode ? getCurrency(suggestedCode) : undefined;
  const recentsList = recentCodes
    .filter((c) => c !== value && c !== suggestedCurrency?.code)
    .map((code) => getCurrency(code))
    .filter((c): c is Currency => !!c);
  const coreCodes = new Set(CoreCurrencies.map((c) => c.code));
  const hiddenInAll = new Set<string>([
    ...recentsList.map((c) => c.code),
    ...(suggestedCurrency ? [suggestedCurrency.code] : []),
  ]);
  const allBase = normalizedSearch ? findCurrency(normalizedSearch) : AllCurrencies;
  const allCurrencies = allBase.filter((c) => !hiddenInAll.has(c.code));
  const otherCurrencies = allCurrencies.filter((c) => !coreCodes.has(c.code) || normalizedSearch.length > 0);
  const coreFiltered = normalizedSearch
    ? CoreCurrencies.filter((c) => c.code.toLowerCase().includes(normalizedSearch.toLowerCase()) || c.name.toLowerCase().includes(normalizedSearch.toLowerCase()) || c.symbol.toLowerCase().includes(normalizedSearch.toLowerCase()))
    : CoreCurrencies;
  const coreVisible = coreFiltered.filter((c) => !hiddenInAll.has(c.code));

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
          "z-[100] w-[var(--radix-popover-trigger-width)] max-w-[min(380px,calc(100vw-2rem))] min-w-0 overflow-hidden p-0",
          className
        )}
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={12}
      >
        <Command shouldFilter={false} className="rounded-lg border-0">
          <div className="border-b px-2.5 pt-2.5 pb-2">
            <CommandInput
              placeholder="Search by code, name, or symbol..."
              value={search}
              onValueChange={setSearch}
              className="h-8 px-2.5 text-sm"
            />
          </div>
          <CommandList className="max-h-[320px] overflow-y-auto [&_[cmdk-group]]:px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
            <CommandEmpty>No currency found.</CommandEmpty>
            {suggestedCurrency && (
              <CommandGroup heading="Suggested">
                <CurrencyPickerItem
                  currency={suggestedCurrency}
                  isSelected={value === suggestedCurrency.code}
                  onSelect={() => handleSelect(suggestedCurrency.code)}
                  note={suggestedNote ?? "Auto from location"}
                />
              </CommandGroup>
            )}

            {recentsList.length > 0 && (
              <CommandGroup heading="Recent">
                {recentsList.map((cur) => (
                  <CurrencyPickerItem
                    key={cur.code}
                    currency={cur}
                    isSelected={value === cur.code}
                    onSelect={() => handleSelect(cur.code)}
                  />
                ))}
              </CommandGroup>
            )}

            {(coreVisible.length > 0 || otherCurrencies.length > 0) && (
              <CommandGroup heading="All currencies">
                {coreVisible.map((cur) => (
                  <CurrencyPickerItem
                    key={cur.code}
                    currency={cur}
                    isSelected={value === cur.code}
                    onSelect={() => handleSelect(cur.code)}
                  />
                ))}
                {(showAll || normalizedSearch ? otherCurrencies : otherCurrencies.slice(0, 20)).map((cur) => (
                  <CurrencyPickerItem
                    key={cur.code}
                    currency={cur}
                    isSelected={value === cur.code}
                    onSelect={() => handleSelect(cur.code)}
                  />
                ))}
                {!normalizedSearch && !showAll && otherCurrencies.length > 20 && (
                  <CommandItem
                    onSelect={() => setShowAll(true)}
                    className="text-muted-foreground min-h-[44px]"
                  >
                    Show all {otherCurrencies.length + coreVisible.length} currencies…
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
