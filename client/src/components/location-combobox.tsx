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
import { cn } from "@/lib/utils";
import {
  type LocationOption,
  searchLocations,
  currencyForCountry,
} from "@/lib/locations-data";
import { getCurrencyLabelShort } from "@/lib/currencies";

export interface LocationComboboxProps {
  value: LocationOption | null;
  onChange: (loc: LocationOption | null) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  "data-testid"?: string;
}

export function LocationCombobox({
  value,
  onChange,
  placeholder = "Search city or country…",
  className,
  triggerClassName,
  "data-testid": dataTestId,
}: LocationComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const results = React.useMemo(
    () => searchLocations(search),
    [search]
  );
  const showMinCharsMessage = search.trim().length > 0 && search.trim().length < 2;

  const handleSelect = (loc: LocationOption) => {
    onChange(loc);
    setOpen(false);
    setSearch("");
  };

  const currencyPreview = value ? currencyForCountry(value.countryCode) : null;
  const currencyLabel = currencyPreview ? getCurrencyLabelShort(currencyPreview) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label="Select location"
          data-testid={dataTestId}
          className={cn(
            "flex items-center justify-between gap-2 w-full rounded-md border border-input bg-background text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "h-10 px-3 min-w-0",
            triggerClassName
          )}
        >
          <span className="truncate min-w-0 text-left flex-1">
            {value ? value.locationName : placeholder}
          </span>
          {value && currencyLabel && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {currencyLabel}
            </span>
          )}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0 overflow-hidden z-[100]",
          "min-w-[var(--radix-popover-trigger-width)] w-[max(var(--radix-popover-trigger-width),260px)]",
          className
        )}
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false} className="rounded-lg border-0">
          <CommandInput
            placeholder="Search city or country…"
            value={search}
            onValueChange={setSearch}
            className="h-9"
          />
          <CommandList className="max-h-[280px]">
            <CommandEmpty>
              {showMinCharsMessage ? "Type at least 2 characters" : "No locations found"}
            </CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="text-muted-foreground min-h-[44px]"
                >
                  Clear location
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {results.map((loc) => {
                const curr = currencyForCountry(loc.countryCode);
                return (
                  <CommandItem
                    key={`${loc.city}-${loc.countryCode}`}
                    value={loc.locationName}
                    onSelect={() => handleSelect(loc)}
                    className="flex items-center gap-3 min-h-[44px] rounded-md px-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium truncate block">{loc.locationName}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {getCurrencyLabelShort(curr)}
                      </span>
                    </div>
                    {value?.city === loc.city && value?.countryCode === loc.countryCode && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
