"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import type { LocationOption } from "@/lib/locations-data";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildLocationSuggestionSections, type LocationUiText } from "@/lib/location-suggestions";

type PrivateLocationTypeaheadProps = {
  value: LocationOption | null;
  onChange: (next: LocationOption | null) => void;
  recent: LocationOption[];
  suggested: LocationOption[];
  uiText: LocationUiText;
  className?: string;
  "data-testid"?: string;
};

export function PrivateLocationTypeahead({
  value,
  onChange,
  recent,
  suggested,
  uiText,
  className,
  "data-testid": dataTestId,
}: PrivateLocationTypeaheadProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const sections = React.useMemo(
    () => buildLocationSuggestionSections({ query, recent, suggested, uiText }),
    [query, recent, suggested, uiText],
  );

  const hasQuery = query.trim().length > 0;

  const typedLocationOption = React.useMemo<LocationOption | null>(() => {
    const typed = query.trim();
    if (!typed) return null;
    const parts = typed.split(",").map((part) => part.trim()).filter(Boolean);
    const city = parts[0] ?? typed;
    const countryName = parts.length > 1 ? parts[parts.length - 1] : "";
    return {
      locationName: typed,
      city,
      countryCode: "",
      countryName,
    };
  }, [query]);

  const handlePick = (option: LocationOption) => {
    onChange(option);
    setOpen(false);
    setQuery("");
  };

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
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            className,
          )}
        >
          <span className="truncate text-left min-w-0">
            {value?.locationName || uiText.placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[max(var(--radix-popover-trigger-width),300px)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={uiText.placeholder}
            value={query}
            onValueChange={setQuery}
            className="h-9"
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{uiText.noResults}</CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-muted-foreground"
                >
                  {uiText.clear}
                </CommandItem>
              </CommandGroup>
            )}
            {sections.map((section) => (
              <CommandGroup key={`location-section-${section.id}`} heading={section.label}>
                {section.items.map((item) => (
                  <CommandItem
                    key={`${section.id}-${item.locationName}`}
                    value={`${section.id}-${item.locationName}`}
                    onSelect={() => handlePick(item)}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{item.locationName}</span>
                    </div>
                    {value?.locationName === item.locationName ? <Check className="h-4 w-4 text-primary" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {typedLocationOption && hasQuery && (
              <CommandGroup>
                <CommandItem value={`typed-${typedLocationOption.locationName}`} onSelect={() => handlePick(typedLocationOption)}>
                  <div className="min-w-0 flex-1">
                    <span className="block font-medium">{uiText.useTyped}</span>
                    <span className="block text-xs text-muted-foreground truncate">{typedLocationOption.locationName}</span>
                  </div>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
