import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarDays, Check, ChevronDown, Clock3, Loader2, PartyPopper, Plane, X } from "lucide-react";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { useAuth } from "@/hooks/use-auth";
import { useCreateBarbecue } from "@/hooks/use-bbq-data";
import { useAppToast } from "@/hooks/use-app-toast";
import { useNewPlanWizard } from "@/contexts/new-plan-wizard";
import type { LocationOption } from "@/lib/locations-data";
import { currencyForCountry } from "@/lib/locations-data";
import { enrichLocationByPlaceId, searchLocationsGlobal } from "@/lib/location-search";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/currency-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type PlanType = "trip" | "party";
type TripSubcategory =
  | "backpacking"
  | "city_trip"
  | "workation"
  | "roadtrip"
  | "ski_trip"
  | "beach_getaway"
  | "festival_trip"
  | "weekend_escape";
type PartySubcategory =
  | "barbecue"
  | "cinema"
  | "game_night"
  | "dinner"
  | "house_party"
  | "birthday"
  | "drinks_night"
  | "brunch";
type Subcategory = TripSubcategory | PartySubcategory;
type WizardStep = "BASICS" | "TYPE";

type SubcategoryDef = {
  id: Subcategory;
  label: string;
  emoji: string;
  eventTypeValue: string;
  area: "trips" | "parties";
  templateId: string;
};

const PLAN_TYPES: Array<{ id: PlanType; label: string; description: string; icon: typeof Plane }> = [
  { id: "trip", label: "Trip", description: "Travel plans and shared costs", icon: Plane },
  { id: "party", label: "Party", description: "Celebrate and coordinate with friends", icon: PartyPopper },
];

const TRIP_SUBCATEGORIES: SubcategoryDef[] = [
  { id: "backpacking", label: "Backpacking", emoji: "🎒", eventTypeValue: "backpacking", area: "trips", templateId: "trip" },
  { id: "city_trip", label: "City trip", emoji: "🏙️", eventTypeValue: "city_trip", area: "trips", templateId: "trip" },
  { id: "workation", label: "Workation", emoji: "💻", eventTypeValue: "workation", area: "trips", templateId: "trip" },
  { id: "roadtrip", label: "Roadtrip", emoji: "🚗", eventTypeValue: "road_trip", area: "trips", templateId: "trip" },
  { id: "ski_trip", label: "Ski trip", emoji: "🎿", eventTypeValue: "ski_trip", area: "trips", templateId: "trip" },
  { id: "beach_getaway", label: "Beach getaway", emoji: "🏖️", eventTypeValue: "beach_trip", area: "trips", templateId: "trip" },
  { id: "festival_trip", label: "Festival trip", emoji: "🎪", eventTypeValue: "festival_trip", area: "trips", templateId: "trip" },
  { id: "weekend_escape", label: "Weekend escape", emoji: "🧳", eventTypeValue: "weekend_getaway", area: "trips", templateId: "weekend" },
];

const PARTY_SUBCATEGORIES: SubcategoryDef[] = [
  { id: "barbecue", label: "Barbecue", emoji: "🔥", eventTypeValue: "barbecue", area: "parties", templateId: "party" },
  { id: "cinema", label: "Cinema", emoji: "🎬", eventTypeValue: "cinema", area: "parties", templateId: "generic" },
  { id: "game_night", label: "Game night", emoji: "🎮", eventTypeValue: "game_night", area: "parties", templateId: "game_night" },
  { id: "dinner", label: "Dinner", emoji: "🍝", eventTypeValue: "dinner_party", area: "parties", templateId: "dinner" },
  { id: "house_party", label: "House party", emoji: "🏠", eventTypeValue: "house_party", area: "parties", templateId: "party" },
  { id: "birthday", label: "Birthday", emoji: "🎂", eventTypeValue: "birthday", area: "parties", templateId: "party" },
  { id: "drinks_night", label: "Drinks night", emoji: "🍸", eventTypeValue: "after_party", area: "parties", templateId: "party" },
  { id: "brunch", label: "Picnic", emoji: "🧺", eventTypeValue: "day_out", area: "parties", templateId: "generic" },
];

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function toIsoDate(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function parseIsoDateToLocal(isoDate: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  return new Date(year, month - 1, day, 12, 0, 0);
}

function formatDateLabel(isoDate: string): string {
  const parsed = parseIsoDateToLocal(isoDate);
  if (!parsed) return "Select date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatTimeLabel(value: string): string {
  const [hRaw, mRaw] = value.split(":");
  const hour = Number(hRaw);
  const minute = Number(mRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(2000, 0, 1, hour, minute, 0));
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = (index % 2) * 30;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

const LAST_PLAN_CURRENCY_KEY = "splanno:last-plan-currency";

export default function NewPlanWizardDrawer() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const createBbq = useCreateBarbecue();
  const { toastSuccess, toastError } = useAppToast();
  const { isNewPlanWizardOpen, newPlanWizardStep, openNewPlanWizard, closeNewPlanWizard } = useNewPlanWizard();
  const planNameInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<WizardStep>("BASICS");
  const [name, setName] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationOption[]>([]);
  const [locationSearchOpen, setLocationSearchOpen] = useState(false);
  const [isSearchingLocations, setIsSearchingLocations] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const timePickerRef = useRef<HTMLDivElement | null>(null);
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [touchedLocation, setTouchedLocation] = useState(false);
  const [planCurrency, setPlanCurrency] = useState("EUR");
  const [localCurrency, setLocalCurrency] = useState<string>("");

  useEffect(() => {
    if (!isNewPlanWizardOpen) return;
    setStep(newPlanWizardStep === "BASICS" ? "BASICS" : "TYPE");
  }, [isNewPlanWizardOpen, newPlanWizardStep]);

  const reset = () => {
    setStep("BASICS");
    setName("");
    setLocationQuery("");
    setSelectedLocation(null);
    setLocationSuggestions([]);
    setLocationSearchOpen(false);
    setIsSearchingLocations(false);
    setLocationSearchError(null);
    setDate(todayIso());
    setTime("");
    setDatePickerOpen(false);
    setTimePickerOpen(false);
    setPlanType(null);
    setSubcategory(null);
    setTouchedLocation(false);
    setPlanCurrency("EUR");
    setLocalCurrency("");
  };

  useEffect(() => {
    if (!isNewPlanWizardOpen) return;
    let initial = (user?.defaultCurrencyCode || "").trim().toUpperCase();
    if (typeof window !== "undefined") {
      const cached = window.localStorage.getItem(LAST_PLAN_CURRENCY_KEY)?.trim().toUpperCase();
      if (cached && /^[A-Z]{3}$/.test(cached)) initial = cached;
    }
    setPlanCurrency(/^[A-Z]{3}$/.test(initial) ? initial : "EUR");
    setLocalCurrency("");
  }, [isNewPlanWizardOpen, user?.defaultCurrencyCode]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeNewPlanWizard();
      reset();
    }
  };

  const subcategories = useMemo(
    () => (planType === "trip" ? TRIP_SUBCATEGORIES : planType === "party" ? PARTY_SUBCATEGORIES : []),
    [planType],
  );
  const selectedSubcategory = subcategories.find((item) => item.id === subcategory) ?? null;
  const canGoNext = name.trim().length > 0 && !!selectedLocation;
  const basicsValid = name.trim().length > 0 && !!selectedLocation && date.trim().length > 0 && /^[A-Z]{3}$/.test(planCurrency);
  const typeStepValid = !!planType && !!subcategory;

  useEffect(() => {
    if (!isNewPlanWizardOpen || step !== "BASICS") return;
    const frameId = window.requestAnimationFrame(() => {
      planNameInputRef.current?.focus();
      planNameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [isNewPlanWizardOpen, step]);

  useEffect(() => {
    if (!selectedLocation) return;
    const suggestedLocal = currencyForCountry(selectedLocation.countryCode ?? "")?.toUpperCase() ?? "";
    if (!suggestedLocal) return;
    if (suggestedLocal === planCurrency) {
      setLocalCurrency((current) => (current === suggestedLocal ? "" : current));
      return;
    }
    setLocalCurrency((current) => current || suggestedLocal);
  }, [selectedLocation, planCurrency]);

  useEffect(() => {
    const q = locationQuery.trim();
    if (import.meta.env.DEV) {
      console.debug("[places-ui] effect enter", {
        query: locationQuery,
        trimmedQuery: q,
        queryLength: q.length,
        selectedLocationName: selectedLocation?.locationName ?? null,
        selectedLocationPlaceId: selectedLocation?.placeId ?? null,
      });
    }
    if (!q) {
      if (import.meta.env.DEV) console.debug("[places-ui] effect early return: empty query");
      setLocationSuggestions([]);
      setIsSearchingLocations(false);
      setLocationSearchError(null);
      return;
    }
    if (q.length < 2) {
      if (import.meta.env.DEV) console.debug("[places-ui] effect early return: query too short");
      setLocationSuggestions([]);
      setIsSearchingLocations(false);
      setLocationSearchError(null);
      return;
    }
    if (selectedLocation && q === selectedLocation.locationName) {
      if (import.meta.env.DEV) {
        console.debug("[places-ui] effect early return: query matches selected location", {
          selectedLocation: selectedLocation.locationName,
        });
      }
      setLocationSuggestions([]);
      setIsSearchingLocations(false);
      setLocationSearchError(null);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      if (import.meta.env.DEV) {
        console.debug("[places-ui] debounce fired -> starting search", { query: q });
      }
      setIsSearchingLocations(true);
      setLocationSearchError(null);
      try {
        if (import.meta.env.DEV) {
          console.debug("[places-ui] calling searchLocationsGlobal", { query: q });
        }
        const suggestions = await searchLocationsGlobal(q, controller.signal);
        if (import.meta.env.DEV) {
          console.debug("[places-ui] searchLocationsGlobal resolved", {
            query: q,
            suggestionsCount: suggestions.length,
            suggestions,
          });
        }
        setLocationSuggestions(suggestions);
      } catch {
        if (import.meta.env.DEV) {
          console.debug("[places-ui] searchLocationsGlobal failed", { query: q });
        }
        setLocationSuggestions([]);
        setLocationSearchError("Couldn’t load locations");
      } finally {
        if (import.meta.env.DEV) {
          console.debug("[places-ui] search finalize", { query: q });
        }
        setIsSearchingLocations(false);
      }
    }, 280);

    return () => {
      if (import.meta.env.DEV) {
        console.debug("[places-ui] effect cleanup", { query: q });
      }
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [locationQuery, selectedLocation]);

  const trimmedLocationQuery = locationQuery.trim();
  const hasLocationSuggestions = locationSuggestions.length > 0;
  const showLocationNoResults =
    locationSearchOpen
    && trimmedLocationQuery.length >= 2
    && !isSearchingLocations
    && !locationSearchError
    && !hasLocationSuggestions;

  useEffect(() => {
    if (!import.meta.env.DEV || !locationSearchOpen) return;
    console.debug("[places-ui] dropdown state", {
      query: trimmedLocationQuery,
      open: locationSearchOpen,
      isSearchingLocations,
      locationSearchError,
      suggestionsCount: locationSuggestions.length,
      hasLocationSuggestions,
      showLocationNoResults,
    });
  }, [
    trimmedLocationQuery,
    locationSearchOpen,
    isSearchingLocations,
    locationSearchError,
    locationSuggestions.length,
    hasLocationSuggestions,
    showLocationNoResults,
  ]);

  useEffect(() => {
    if (!timePickerOpen) return;
    const handleDocumentPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (timePickerRef.current?.contains(target)) return;
      setTimePickerOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTimePickerOpen(false);
    };
    document.addEventListener("mousedown", handleDocumentPointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleDocumentPointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [timePickerOpen]);

  const goNext = () => {
    if (step === "BASICS") {
      if (!basicsValid) {
        setTouchedLocation(true);
        return;
      }
      setStep("TYPE");
    }
  };

  const goBack = () => {
    if (step === "TYPE") {
      setStep("BASICS");
      return;
    }
    closeNewPlanWizard();
    reset();
  };

  const handleCreate = () => {
    if (!basicsValid || !planType || !selectedSubcategory || createBbq.isPending) return;
    const location = selectedLocation;
    if (!location) return;
    const fallbackDateIso = `${date}T12:00:00.000Z`;
    const submittedDate = time
      ? new Date(`${date}T${time}`).toISOString()
      : fallbackDateIso;
    createBbq.mutate(
      {
        name: name.trim(),
        date: submittedDate,
        currency: planCurrency,
        planCurrency,
        localCurrency: localCurrency.trim() || null,
        localDate: date,
        localTime: time || null,
        creatorUserId: user?.id ?? undefined,
        isPublic: false,
        visibility: "private",
        visibilityOrigin: "private",
        area: selectedSubcategory.area,
        eventType: selectedSubcategory.eventTypeValue,
        locationName: location.locationName,
        locationText: location.locationName,
        placeId: location.placeId || undefined,
        city: location.city || undefined,
        countryCode: normalizeCountryCode(location.countryCode) ?? undefined,
        countryName: location.countryName || undefined,
        latitude: location.lat ?? undefined,
        longitude: location.lng ?? undefined,
        locationMeta: {
          displayName: location.displayName || undefined,
          formattedAddress: location.formattedAddress || undefined,
        },
        templateData: {
          mainCategory: planType,
          subCategory: subcategory,
          privateMainCategory: planType,
          privateSubCategory: subcategory,
          privateEventTypeId: subcategory,
          privateTemplateId: selectedSubcategory.templateId,
          emoji: selectedSubcategory.emoji,
        },
      },
      {
        onSuccess: (created) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(LAST_PLAN_CURRENCY_KEY, planCurrency);
          }
          toastSuccess("Plan created");
          closeNewPlanWizard();
          reset();
          setLocation(`/app/e/${created.id}`);
        },
        onError: () => {
          toastError("Couldn’t create plan. Try again.");
        },
      },
    );
  };

  const selectLocationSuggestion = async (option: LocationOption) => {
    setSelectedLocation(option);
    setLocationQuery(option.locationName);
    setLocationSearchOpen(false);
    setLocationSearchError(null);
    setTouchedLocation(false);
    if (!option.placeId) return;
    try {
      const enriched = await enrichLocationByPlaceId(option.placeId);
      if (!enriched) return;
      setSelectedLocation((current) => {
        if (!current?.placeId || current.placeId !== option.placeId) return current;
        return {
          ...current,
          ...enriched,
          locationName: enriched.locationName || current.locationName,
          city: enriched.city || current.city,
          countryCode: enriched.countryCode || current.countryCode,
          countryName: enriched.countryName || current.countryName,
          placeId: enriched.placeId || current.placeId,
          displayName: enriched.displayName || current.displayName,
          formattedAddress: enriched.formattedAddress || current.formattedAddress,
          lat: enriched.lat ?? current.lat,
          lng: enriched.lng ?? current.lng,
        };
      });
    } catch {
      // Selection remains valid even if enrichment fails in this phase.
    }
  };

  return (
    <Sheet open={isNewPlanWizardOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="h-full w-full sm:max-w-[760px] p-0 z-[120]">
        <div className="flex h-full flex-col">
          <header className="shrink-0 border-b border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle>Start a plan</SheetTitle>
              <SheetDescription>Turn an idea into a plan.</SheetDescription>
            </SheetHeader>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full border ${step === "BASICS" ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>The plan</span>
                <span className={`px-2 py-0.5 rounded-full border ${step === "TYPE" ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>Plan type</span>
              </div>

              {step === "BASICS" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Plan name</Label>
                    <Input
                      ref={planNameInputRef}
                      placeholder="What are we celebrating?"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Location</Label>
                    <div className="relative">
                      <Input
                        placeholder="Search by city, region or venue"
                        value={locationQuery}
                        onFocus={() => {
                          if (locationQuery.trim().length >= 2) setLocationSearchOpen(true);
                        }}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setLocationQuery(nextValue);
                          if (selectedLocation && nextValue.trim() !== selectedLocation.locationName) {
                            setSelectedLocation(null);
                          }
                          if (nextValue.trim().length >= 2) setLocationSearchOpen(true);
                          setTouchedLocation(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setLocationSearchOpen(false);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setLocationSearchOpen(false), 120);
                          setTouchedLocation(true);
                        }}
                      />
                      {locationSearchOpen ? (
                        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/70 bg-popover shadow-lg">
                          <div className="max-h-64 overflow-y-auto p-1.5">
                            {isSearchingLocations ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">Searching locations...</div>
                            ) : locationSearchError ? (
                              <div className="px-3 py-2 text-xs text-destructive">{locationSearchError}</div>
                            ) : locationQuery.trim().length < 2 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">Type at least 2 characters</div>
                            ) : showLocationNoResults ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">No locations found</div>
                            ) : (
                              locationSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.placeId || `${suggestion.locationName}-${suggestion.countryCode}-${suggestion.city}`}
                                  type="button"
                                  className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-muted/60"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => { void selectLocationSuggestion(suggestion); }}
                                >
                                  <span className="block truncate text-sm font-medium text-foreground">
                                    {suggestion.locationName}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {[suggestion.city, suggestion.countryName].filter(Boolean).join(", ")}
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {touchedLocation && !selectedLocation ? (
                      <p className="text-xs text-destructive">Please choose a location from the list.</p>
                    ) : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Date</Label>
                      <Popover
                        open={datePickerOpen}
                        onOpenChange={(nextOpen) => {
                          setDatePickerOpen(nextOpen);
                          if (nextOpen) setTimePickerOpen(false);
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm ring-offset-background transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <span className="truncate text-foreground">{formatDateLabel(date)}</span>
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="z-[130] w-auto rounded-xl p-0">
                          <Calendar
                            mode="single"
                            selected={parseIsoDateToLocal(date)}
                            classNames={{
                              // Remove parent-cell selected background to avoid corner artifacts in this single-date picker.
                              cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                              day: "h-9 w-9 rounded-md p-0 text-sm font-normal border border-transparent hover:bg-muted/40",
                              day_selected: "bg-primary text-primary-foreground border-primary hover:bg-primary focus:bg-primary",
                              // Avoid conflicting bg layers for "today + selected" which caused corner artifacts.
                              day_today: "text-foreground font-semibold",
                            }}
                            onSelect={(day) => {
                              if (!day) return;
                              setDate(toIsoDate(day));
                              setDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Time (optional)</Label>
                      <div ref={timePickerRef} className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setTimePickerOpen((open) => {
                              const next = !open;
                              if (next) setDatePickerOpen(false);
                              return next;
                            });
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") setTimePickerOpen(false);
                          }}
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm ring-offset-background transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <span className={`truncate ${time ? "text-foreground" : "text-muted-foreground"}`}>
                            {time ? formatTimeLabel(time) : "Select time"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {time ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setTime("");
                                }}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                aria-label="Clear time"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <Clock3 className="h-4 w-4 text-muted-foreground" />
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </button>
                        {timePickerOpen ? (
                          <div className="absolute left-0 top-[calc(100%+0.35rem)] z-[130] w-[220px] rounded-xl border border-border/70 bg-popover p-2 shadow-lg">
                            <div className="max-h-64 overflow-y-auto overscroll-contain pr-1">
                              <div className="space-y-1">
                                {TIME_OPTIONS.map((option) => {
                                  const selected = time === option;
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                        setTime(option);
                                        setTimePickerOpen(false);
                                      }}
                                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                        selected
                                          ? "bg-primary/10 text-primary"
                                          : "text-foreground hover:bg-muted/60"
                                      }`}
                                    >
                                      <span>{formatTimeLabel(option)}</span>
                                      {selected ? <Check className="h-4 w-4" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Plan currency</Label>
                      <CurrencyPicker
                        value={planCurrency}
                        onChange={(code) => setPlanCurrency(code)}
                        className="z-[130]"
                        triggerClassName="w-full justify-between"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Local currency (optional)</Label>
                      <CurrencyPicker
                        value={localCurrency}
                        onChange={(code) => setLocalCurrency(code === planCurrency ? "" : code)}
                        className="z-[130]"
                        triggerClassName="w-full justify-between"
                        allowEmpty
                        emptyLabel="None"
                        placeholder="Optional"
                        suggestedCode={selectedLocation ? currencyForCountry(selectedLocation.countryCode ?? "") ?? null : null}
                        suggestedNote="Based on location"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === "TYPE" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold">Plan type</h4>
                    <p className="text-xs text-muted-foreground mt-1">Pick what you’re planning and choose a subcategory.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PLAN_TYPES.map((option) => {
                      const Icon = option.icon;
                      const active = planType === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            setPlanType(option.id);
                            setSubcategory(null);
                          }}
                          className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                            active ? "interactive-card border-primary/70 bg-primary/10 shadow-md shadow-primary/15" : "interactive-card border-border/70 hover:bg-muted/20"
                          }`}
                        >
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {option.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                        </button>
                      );
                    })}
                  </div>
                  {planType ? (
                    <div className="space-y-3">
                      <div>
                        <h4 className="text-sm font-semibold">{planType === "trip" ? "Trip type" : "Party type"}</h4>
                        <p className="text-xs text-muted-foreground mt-1">Choose a subcategory.</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {subcategories.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSubcategory(item.id)}
                            className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                              subcategory === item.id ? "interactive-card border-primary/70 bg-primary/10 shadow-md shadow-primary/15" : "interactive-card border-border/70 hover:bg-muted/20"
                            }`}
                          >
                            <p className="text-sm font-semibold flex items-center gap-1.5">
                              <span aria-hidden className="text-lg">{item.emoji}</span>
                              {item.label}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Select a plan type to see subcategories.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
              <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto order-2 sm:order-1">
                {step === "BASICS" ? "Cancel" : "Back"}
              </Button>
              {step === "BASICS" ? (
                <Button
                  onClick={goNext}
                  disabled={!canGoNext}
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold order-1 sm:order-2"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={!basicsValid || !typeStepValid || createBbq.isPending}
                  className="w-full sm:w-auto min-w-[188px] bg-primary text-primary-foreground font-semibold order-1 sm:order-2"
                >
                  {createBbq.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                  Start plan
                </Button>
              )}
            </div>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}
