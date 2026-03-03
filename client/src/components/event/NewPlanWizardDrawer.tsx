import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, PartyPopper, Plane } from "lucide-react";
import { normalizeCountryCode } from "@shared/lib/country-code";
import { useAuth } from "@/hooks/use-auth";
import { useCreateBarbecue } from "@/hooks/use-bbq-data";
import { useAppToast } from "@/hooks/use-app-toast";
import { useNewPlanWizard } from "@/contexts/new-plan-wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
type WizardStep = "BASICS" | "TYPE" | "SUBCATEGORY";

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

export default function NewPlanWizardDrawer() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const createBbq = useCreateBarbecue();
  const { toastSuccess, toastError } = useAppToast();
  const { isNewPlanWizardOpen, newPlanWizardStep, openNewPlanWizard, closeNewPlanWizard } = useNewPlanWizard();

  const [step, setStep] = useState<WizardStep>("BASICS");
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [date, setDate] = useState(todayIso());
  const [time, setTime] = useState("");
  const [planType, setPlanType] = useState<PlanType | null>(null);
  const [subcategory, setSubcategory] = useState<Subcategory | null>(null);
  const [touchedLocation, setTouchedLocation] = useState(false);

  useEffect(() => {
    if (!isNewPlanWizardOpen) return;
    setStep(newPlanWizardStep);
  }, [isNewPlanWizardOpen, newPlanWizardStep]);

  const reset = () => {
    setStep("BASICS");
    setName("");
    setLocationText("");
    setDate(todayIso());
    setTime("");
    setPlanType(null);
    setSubcategory(null);
    setTouchedLocation(false);
  };

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
  const basicsValid = name.trim().length > 0 && locationText.trim().length > 0 && date.trim().length > 0;

  const goNext = () => {
    if (step === "BASICS") {
      if (!basicsValid) {
        setTouchedLocation(true);
        return;
      }
      setStep("TYPE");
      return;
    }
    if (step === "TYPE") {
      if (!planType) return;
      setStep("SUBCATEGORY");
    }
  };

  const goBack = () => {
    if (step === "SUBCATEGORY") {
      setStep("TYPE");
      return;
    }
    if (step === "TYPE") {
      setStep("BASICS");
      return;
    }
    closeNewPlanWizard();
    reset();
  };

  const handleCreate = () => {
    if (!basicsValid || !planType || !selectedSubcategory || createBbq.isPending) return;
    const normalizedCountryCode = normalizeCountryCode("");
    createBbq.mutate(
      {
        name: name.trim(),
        date: new Date(`${date}T${time || "19:00"}`).toISOString(),
        creatorId: user?.username ?? undefined,
        isPublic: false,
        visibility: "private",
        visibilityOrigin: "private",
        area: selectedSubcategory.area,
        eventType: selectedSubcategory.eventTypeValue,
        locationName: locationText.trim(),
        locationText: locationText.trim(),
        countryCode: normalizedCountryCode ?? undefined,
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
                <span className={`px-2 py-0.5 rounded-full border ${step === "TYPE" ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>What kind of plan?</span>
                <span className={`px-2 py-0.5 rounded-full border ${step === "SUBCATEGORY" ? "border-primary/40 text-primary bg-primary/5" : "border-border"}`}>Subcategory</span>
              </div>

              {step === "BASICS" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Plan name</Label>
                    <Input
                      placeholder="What are we celebrating?"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Location</Label>
                    <Input
                      placeholder="Where is it?"
                      value={locationText}
                      onChange={(event) => setLocationText(event.target.value)}
                      onBlur={() => setTouchedLocation(true)}
                    />
                    {touchedLocation && !locationText.trim() ? <p className="text-xs text-destructive">Location is required.</p> : null}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Date</Label>
                      <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs uppercase tracking-wide">Time (optional)</Label>
                      <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {step === "TYPE" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold">Plan type</h4>
                    <p className="text-xs text-muted-foreground mt-1">Pick what you’re planning.</p>
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
                            active ? "border-primary/70 bg-primary/10 shadow-md shadow-primary/15" : "border-border/70 hover:-translate-y-0.5 hover:bg-muted/20"
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
                </div>
              )}

              {step === "SUBCATEGORY" && (
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
                          subcategory === item.id ? "border-primary/70 bg-primary/10 shadow-md shadow-primary/15" : "border-border/70 hover:-translate-y-0.5 hover:bg-muted/20"
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
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 w-full">
              <Button variant="ghost" onClick={goBack} className="w-full sm:w-auto order-2 sm:order-1">
                {step === "BASICS" ? "Cancel" : "Back"}
              </Button>
              {step !== "SUBCATEGORY" ? (
                <Button
                  onClick={goNext}
                  disabled={(step === "BASICS" && !basicsValid) || (step === "TYPE" && !planType)}
                  className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold order-1 sm:order-2"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={!basicsValid || !planType || !subcategory || createBbq.isPending}
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
