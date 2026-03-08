import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CalendarDays, Check, ChevronDown, Clock3, ExternalLink, Loader2, LogOut, MapPin, Sparkles, Trash2, X } from "lucide-react";
import {
  derivePlanTypeSelection,
  getEventTypeForPlanType,
  getPlanMainTypeLabel,
  getPlanSubcategoryLabel,
  PLAN_MAIN_TYPE_OPTIONS,
  PLAN_SUBCATEGORIES_BY_MAIN,
  type PlanMainType,
  type PlanSubcategoryId,
} from "@shared/lib/plan-types";
import { useAuth } from "@/hooks/use-auth";
import { useDeleteBarbecue, useLeaveBarbecue, useUpdateBarbecue } from "@/hooks/use-bbq-data";
import { useAppToast } from "@/hooks/use-app-toast";
import { crewQueryKey, expensesQueryKey, messagesQueryKey, planQueryKey, usePlan, usePlanCrew, usePlanExpenses } from "@/hooks/use-plan-data";
import type { LocationOption } from "@/lib/locations-data";
import { LocationCombobox } from "@/components/location-combobox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PanelHeader, PanelSection, PanelShell, formatPanelDate, formatPanelLocation, useActiveEventId } from "@/components/panels/panel-primitives";
import { usePanel } from "@/state/panel";
import { splannoOutlinePillClass } from "@/lib/utils";

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

function inferLocalDate(planDate: string | Date | null | undefined): string {
  if (!planDate) return toIsoDate(new Date());
  const date = new Date(planDate);
  if (Number.isNaN(date.getTime())) return toIsoDate(new Date());
  return toIsoDate(date);
}

function inferLocalTime(planDate: string | Date | null | undefined): string {
  if (!planDate) return "";
  const date = new Date(planDate);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function mapPlanToLocationOption(plan: {
  locationText?: string | null;
  locationName?: string | null;
  city?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
} | null): LocationOption | null {
  if (!plan) return null;
  const locationName = plan.locationText ?? plan.locationName ?? [plan.city, plan.countryName].filter(Boolean).join(", ");
  if (!locationName) return null;
  return {
    locationName,
    displayName: plan.locationName ?? undefined,
    formattedAddress: plan.locationText ?? undefined,
    city: plan.city ?? "",
    countryCode: plan.countryCode ?? "",
    countryName: plan.countryName ?? "",
    lat: plan.latitude ?? undefined,
    lng: plan.longitude ?? undefined,
    placeId: plan.placeId ?? undefined,
  };
}

function getPlanTypeLabel(plan: { templateData?: unknown; eventType?: string | null } | null) {
  const selection = derivePlanTypeSelection({
    templateData: plan?.templateData,
    eventType: plan?.eventType ?? null,
  });
  if (!selection.mainType) return "General";
  const main = getPlanMainTypeLabel(selection.mainType);
  return selection.subcategory ? `${main} · ${getPlanSubcategoryLabel(selection.subcategory)}` : main;
}

function buildGoogleMapsSearchUrl(location: string | null | undefined) {
  const query = location?.trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function LocationMapLink({
  href,
  children,
  className,
  compact = false,
}: {
  href: string | null;
  children: string;
  className?: string;
  compact?: boolean;
}) {
  if (!href) {
    return <span className={className}>{children}</span>;
  }

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            title="Open in Google Maps"
            className={`group inline-flex items-center gap-1 transition hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className ?? ""}`}
          >
            <span className="truncate underline decoration-transparent underline-offset-2 transition group-hover:decoration-current">
              {children}
            </span>
            <ExternalLink className={`shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
          </a>
        </TooltipTrigger>
        <TooltipContent>
          Open in Google Maps
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = (index % 2) * 30;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

export function PlanDetailsPanel() {
  const eventId = useActiveEventId();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { closePanel } = usePanel();
  const updateBarbecue = useUpdateBarbecue();
  const deleteBarbecue = useDeleteBarbecue();
  const leaveBarbecue = useLeaveBarbecue();
  const { toastSuccess, toastError } = useAppToast();

  const planQuery = usePlan(eventId);
  const crewQuery = usePlanCrew(eventId);
  const expensesQuery = usePlanExpenses(eventId);
  const plan = planQuery.data;
  const participants = crewQuery.data?.participants ?? [];
  const members = crewQuery.data?.members ?? [];
  const expenses = expensesQuery.data ?? [];

  const isCreator = Number(plan?.creatorUserId) === Number(user?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState<LocationOption | null>(null);
  const [dateDraft, setDateDraft] = useState("");
  const [timeDraft, setTimeDraft] = useState("");
  const [mainTypeDraft, setMainTypeDraft] = useState<PlanMainType | null>(null);
  const [subcategoryDraft, setSubcategoryDraft] = useState<PlanSubcategoryId | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const timePickerRef = useRef<HTMLDivElement | null>(null);

  const currentTypeSelection = useMemo(() => derivePlanTypeSelection({
    templateData: plan?.templateData,
    eventType: plan?.eventType ?? null,
  }), [plan?.templateData, plan?.eventType]);

  useEffect(() => {
    if (!plan) return;
    if (isEditing) return;
    setNameDraft(plan.name ?? "");
    setLocationDraft(mapPlanToLocationOption(plan));
    setDateDraft((typeof plan.localDate === "string" && plan.localDate.trim()) ? plan.localDate.trim() : inferLocalDate(plan.date));
    setTimeDraft((typeof plan.localTime === "string" && plan.localTime.trim()) ? plan.localTime.trim() : inferLocalTime(plan.date));
    setMainTypeDraft(currentTypeSelection.mainType);
    setSubcategoryDraft(currentTypeSelection.subcategory);
  }, [plan, isEditing, currentTypeSelection.mainType, currentTypeSelection.subcategory]);

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

  const availableSubcategories = mainTypeDraft ? PLAN_SUBCATEGORIES_BY_MAIN[mainTypeDraft] : [];
  const creatorLeaveSuccessor = useMemo(() => (
    members
      .filter((member) => Number(member.userId) !== Number(user?.id))
      .slice()
      .sort((left, right) => {
        const leftTime = left.joinedAt ? new Date(left.joinedAt).getTime() : Number.POSITIVE_INFINITY;
        const rightTime = right.joinedAt ? new Date(right.joinedAt).getTime() : Number.POSITIVE_INFINITY;
        if (leftTime !== rightTime) return leftTime - rightTime;
        return Number(left.id) - Number(right.id);
      })[0] ?? null
  ), [members, user?.id]);
  const creatorLeaveWillDeletePlan = isCreator && !creatorLeaveSuccessor;
  const canSave = !!eventId
    && !!nameDraft.trim()
    && !!locationDraft
    && !!dateDraft
    && !!mainTypeDraft
    && !!subcategoryDraft;

  const startEdit = () => {
    if (!isCreator || !plan) return;
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!plan) {
      setIsEditing(false);
      return;
    }
    setNameDraft(plan.name ?? "");
    setLocationDraft(mapPlanToLocationOption(plan));
    setDateDraft((typeof plan.localDate === "string" && plan.localDate.trim()) ? plan.localDate.trim() : inferLocalDate(plan.date));
    setTimeDraft((typeof plan.localTime === "string" && plan.localTime.trim()) ? plan.localTime.trim() : inferLocalTime(plan.date));
    setMainTypeDraft(currentTypeSelection.mainType);
    setSubcategoryDraft(currentTypeSelection.subcategory);
    setDatePickerOpen(false);
    setTimePickerOpen(false);
    setIsEditing(false);
  };

  const handleDeletePlan = async () => {
    if (!plan || !eventId || !isCreator) return;

    try {
      const result = await deleteBarbecue.mutateAsync(eventId);
      const deletedPlanId = result.deletedPlanId;
      queryClient.setQueryData(["/api/barbecues"], (current: unknown) => (
        Array.isArray(current)
          ? current.filter((entry) => Number((entry as { id?: unknown }).id) !== deletedPlanId)
          : current
      ));
      queryClient.removeQueries({ queryKey: planQueryKey(deletedPlanId) });
      queryClient.removeQueries({ queryKey: messagesQueryKey(deletedPlanId) });
      queryClient.removeQueries({ queryKey: expensesQueryKey(deletedPlanId) });
      queryClient.removeQueries({ queryKey: crewQueryKey(deletedPlanId) });
      setDeleteDialogOpen(false);
      setDeleteConfirmName("");
      closePanel();
      setLocation("/app/private", { replace: true });
      toastSuccess("Plan deleted");
    } catch (error) {
      const message = (error as Error)?.message ?? "Failed to delete plan";
      if (/only the creator/i.test(message)) {
        toastError("Only the creator can delete this plan");
        return;
      }
      if (/not found/i.test(message)) {
        toastError("Plan not found");
        return;
      }
      toastError("Failed to delete plan");
    }
  };

  const handleLeavePlan = async () => {
    if (!plan || !eventId) return;

    try {
      await leaveBarbecue.mutateAsync(eventId);
      queryClient.setQueryData(["/api/barbecues"], (current: unknown) => (
        Array.isArray(current)
          ? current.filter((entry) => Number((entry as { id?: unknown }).id) !== eventId)
          : current
      ));
      queryClient.removeQueries({ queryKey: planQueryKey(eventId) });
      queryClient.removeQueries({ queryKey: messagesQueryKey(eventId) });
      queryClient.removeQueries({ queryKey: expensesQueryKey(eventId) });
      queryClient.removeQueries({ queryKey: crewQueryKey(eventId) });
      setLeaveDialogOpen(false);
      closePanel();
      setLocation("/app/private", { replace: true });
      toastSuccess("You left the plan");
    } catch (error) {
      const message = (error as Error)?.message ?? "Failed to leave plan";
      if (/not a member/i.test(message)) {
        toastError("You are not a member of this plan");
        return;
      }
      if (/not found/i.test(message)) {
        toastError("Plan not found");
        return;
      }
      toastError("Failed to leave plan");
    }
  };

  const saveEdit = async () => {
    if (!plan || !eventId || !isCreator || !canSave || !mainTypeDraft || !subcategoryDraft || !locationDraft) return;
    const submittedDate = timeDraft
      ? new Date(`${dateDraft}T${timeDraft}`).toISOString()
      : `${dateDraft}T12:00:00.000Z`;

    try {
      await updateBarbecue.mutateAsync({
        id: eventId,
        name: nameDraft.trim(),
        date: submittedDate,
        eventType: getEventTypeForPlanType(mainTypeDraft, subcategoryDraft),
        locationName: locationDraft.displayName || locationDraft.locationName,
        locationText: locationDraft.formattedAddress || locationDraft.locationName,
        placeId: locationDraft.placeId || null,
        city: locationDraft.city || null,
        countryCode: locationDraft.countryCode || null,
        countryName: locationDraft.countryName || null,
        latitude: locationDraft.lat ?? null,
        longitude: locationDraft.lng ?? null,
        templateData: {
          ...(plan.templateData && typeof plan.templateData === "object" ? plan.templateData as Record<string, unknown> : {}),
          mainCategory: mainTypeDraft,
          subCategory: subcategoryDraft,
          privateMainCategory: mainTypeDraft,
          privateSubCategory: subcategoryDraft,
          privateEventTypeId: subcategoryDraft,
        },
      });
      toastSuccess("Plan updated");
      setIsEditing(false);
    } catch (error) {
      toastError((error as Error).message || "Couldn’t save changes");
    }
  };

  const typedDeleteNameMatches = plan?.name?.trim() ? deleteConfirmName.trim() === plan.name.trim() : false;
  const locationLabel = formatPanelLocation(plan);
  const googleMapsUrl = buildGoogleMapsSearchUrl(locationLabel);

  return (
    <PanelShell>
      <PanelHeader
        label="Plan details"
        title={plan?.name ?? "Plan"}
        actions={isCreator && plan ? (
          !isEditing ? (
            <Button type="button" variant="outline" size="sm" className={`h-8 rounded-full px-3 ${splannoOutlinePillClass()}`} onClick={startEdit}>
              Edit plan
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className={`h-8 rounded-full px-3 ${splannoOutlinePillClass()}`} onClick={cancelEdit} disabled={updateBarbecue.isPending}>
                Cancel
              </Button>
              <Button type="button" size="sm" className="h-8 rounded-full px-3" onClick={() => { void saveEdit(); }} disabled={!canSave || updateBarbecue.isPending}>
                {updateBarbecue.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          )
        ) : undefined}
        meta={(
          <>
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {formatPanelDate(plan?.date)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <LocationMapLink href={googleMapsUrl} className="min-w-0 truncate" compact>
                {locationLabel}
              </LocationMapLink>
            </span>
          </>
        )}
      />

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {!plan ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 text-sm text-muted-foreground">
            Open a plan chat to inspect its details.
          </div>
        ) : (
          <>
            <PanelSection title="Overview">
              {!isEditing ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">Location</span>
                    <LocationMapLink href={googleMapsUrl} className="font-medium text-foreground">
                      {locationLabel}
                    </LocationMapLink>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium text-foreground">{formatPanelDate(plan.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-details-name">Plan name</Label>
                    <Input
                      id="plan-details-name"
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      placeholder="Plan name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <LocationCombobox
                      value={locationDraft}
                      onChange={setLocationDraft}
                      placeholder="Search city or country…"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Date</Label>
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
                            <span className="truncate text-foreground">{formatDateLabel(dateDraft)}</span>
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="z-[130] w-auto rounded-xl p-0">
                          <Calendar
                            mode="single"
                            selected={parseIsoDateToLocal(dateDraft)}
                            classNames={{
                              cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
                              day: "h-9 w-9 rounded-md p-0 text-sm font-normal border border-transparent hover:bg-muted/40",
                              day_selected: "bg-primary text-primary-foreground border-primary hover:bg-primary focus:bg-primary",
                              day_today: "text-foreground font-semibold",
                            }}
                            onSelect={(day) => {
                              if (!day) return;
                              setDateDraft(toIsoDate(day));
                              setDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Time (optional)</Label>
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
                          className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-sm ring-offset-background transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <span className={`truncate ${timeDraft ? "text-foreground" : "text-muted-foreground"}`}>
                            {timeDraft ? formatTimeLabel(timeDraft) : "Select time"}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {timeDraft ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setTimeDraft("");
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
                                  const selected = timeDraft === option;
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() => {
                                        setTimeDraft(option);
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
                </div>
              )}
            </PanelSection>

            <PanelSection title="Plan setup">
              {!isEditing ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2">
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                      <Sparkles className="h-4 w-4" />
                      Plan type
                    </span>
                    <span className="font-medium text-foreground">{getPlanTypeLabel(plan)}</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Plan type</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {PLAN_MAIN_TYPE_OPTIONS.map((option) => {
                        const active = mainTypeDraft === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setMainTypeDraft(option.id);
                              const currentSubInType = subcategoryDraft && PLAN_SUBCATEGORIES_BY_MAIN[option.id].some((item) => item.id === subcategoryDraft);
                              if (!currentSubInType) setSubcategoryDraft(null);
                            }}
                            className={`interactive-card rounded-xl border px-3 py-2 text-left text-sm ${
                              active ? "border-primary/70 bg-primary/10 text-foreground" : "border-border/70 bg-background hover:bg-muted/30"
                            }`}
                          >
                            <p className="font-medium">{option.label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {mainTypeDraft ? (
                    <div className="space-y-2">
                      <Label>Subcategory</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {availableSubcategories.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setSubcategoryDraft(item.id)}
                            className={`interactive-card rounded-xl border px-3 py-2 text-left text-sm ${
                              subcategoryDraft === item.id ? "border-primary/70 bg-primary/10 text-foreground" : "border-border/70 bg-background hover:bg-muted/30"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Snapshot">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Crew</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{participants.length}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
                  <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{expenses.length}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-2 text-sm font-semibold tracking-tight text-foreground">{String(plan.status ?? "active")}</p>
                </div>
              </div>
            </PanelSection>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`h-10 rounded-full px-4 ${splannoOutlinePillClass()}`}
                onClick={() => setLeaveDialogOpen(true)}
                disabled={leaveBarbecue.isPending}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Leave plan
              </Button>
              {isCreator ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full border-destructive/30 px-4 text-destructive hover:bg-destructive/5 hover:text-destructive"
                  onClick={() => {
                    setDeleteConfirmName("");
                    setDeleteDialogOpen(true);
                  }}
                  disabled={deleteBarbecue.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete plan
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCreator
                ? (
                  creatorLeaveWillDeletePlan
                    ? "You are the creator and the last member. Leaving will permanently delete this plan."
                    : `You are the creator. Ownership will transfer to ${creatorLeaveSuccessor?.name ?? "the next member"} when you leave.`
                )
                : "You will lose access to the chat, expenses, balances, and activity history for this plan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveBarbecue.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leaveBarbecue.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleLeavePlan();
              }}
            >
              {leaveBarbecue.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Leave plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDeleteConfirmName("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the chat, expenses, balances, and activity history. Type the plan name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-plan-confirm-name">Plan name</Label>
            <Input
              id="delete-plan-confirm-name"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              placeholder={plan?.name ?? "Plan name"}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBarbecue.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBarbecue.isPending || !typedDeleteNameMatches}
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePlan();
              }}
            >
              {deleteBarbecue.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelShell>
  );
}

export default PlanDetailsPanel;
