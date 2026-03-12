import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { useAppToast } from "@/hooks/use-app-toast";
import { resolveAssetUrl } from "@/lib/asset-url";

type PlanDetailsValues = {
  name: string;
  locationText: string;
  startDate: string;
  endDate: string;
  bannerUrl: string | null;
};

type PlanDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id?: number;
    name: string;
    date: string | Date | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    locationText?: string | null;
    locationName?: string | null;
    city?: string | null;
    countryName?: string | null;
    bannerUrl?: string | null;
    bannerImageUrl?: string | null;
  } | null;
  saving?: boolean;
  onSave: (updates: PlanDetailsValues) => Promise<void>;
  isCreator?: boolean;
  canEditDates?: boolean;
  deleting?: boolean;
  onDelete?: () => Promise<void> | void;
  leaving?: boolean;
  onLeave?: () => Promise<void> | void;
  leaveTransferTargetName?: string | null;
  willDeleteOnLeave?: boolean;
};

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function PlanDetailsDrawer({
  open,
  onOpenChange,
  plan,
  saving = false,
  onSave,
  isCreator = false,
  canEditDates = false,
  deleting = false,
  onDelete,
  leaving = false,
  onLeave,
  leaveTransferTargetName = null,
  willDeleteOnLeave = false,
}: PlanDetailsDrawerProps) {
  const { toastError } = useAppToast();
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [bannerMode, setBannerMode] = useState<"upload" | "url">("upload");
  const [bannerUrlDraft, setBannerUrlDraft] = useState<string | null>(null);
  const [bannerUrlInput, setBannerUrlInput] = useState("");
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerImageLoading, setBannerImageLoading] = useState(false);
  const [bannerImageFailed, setBannerImageFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [baseline, setBaseline] = useState<{ name: string; locationText: string; startDate: string; endDate: string; bannerUrl: string | null } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const initializedPlanIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !plan) return;
    const planId = Number.isInteger(plan.id) ? Number(plan.id) : null;
    if (initializedPlanIdRef.current === planId) return;
    initializedPlanIdRef.current = planId;

    const nextName = plan.name ?? "";
    const nextLocation =
      plan.locationText?.trim()
      || plan.locationName?.trim()
      || [plan.city, plan.countryName].filter(Boolean).join(", ").trim()
      || "";
    const nextStartDate = toDateInputValue(plan.startDate ?? plan.date);
    const nextEndDate = toDateInputValue(plan.endDate ?? plan.startDate ?? plan.date);

    setName(nextName);
    setLocationText(nextLocation);
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    const nextBannerUrl = plan.bannerUrl ?? plan.bannerImageUrl ?? null;
    setBannerMode("upload");
    setBannerUrlDraft(nextBannerUrl);
    setBannerUrlInput(/^https?:\/\//i.test(nextBannerUrl ?? "") ? (nextBannerUrl ?? "") : "");
    setBannerError(null);
    setUploadingBanner(false);
    setBannerImageLoading(Boolean(nextBannerUrl));
    setBannerImageFailed(false);
    setBaseline({
      name: nextName,
      locationText: nextLocation,
      startDate: nextStartDate,
      endDate: nextEndDate,
      bannerUrl: nextBannerUrl,
    });
  }, [open, plan?.id]);

  useEffect(() => {
    if (!open) {
      initializedPlanIdRef.current = null;
      setDeleteDialogOpen(false);
      setLeaveDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!bannerUrlDraft) {
      setBannerImageLoading(false);
      setBannerImageFailed(false);
      return;
    }
    setBannerImageLoading(true);
    setBannerImageFailed(false);
  }, [bannerUrlDraft]);

  const initialName = baseline?.name ?? plan?.name ?? "";
  const initialLocation = baseline?.locationText
    ?? (
      plan?.locationText?.trim()
      || plan?.locationName?.trim()
      || [plan?.city, plan?.countryName].filter(Boolean).join(", ").trim()
      || ""
    );
  const initialStartDate = baseline?.startDate ?? toDateInputValue(plan?.startDate ?? plan?.date ?? null);
  const initialEndDate = baseline?.endDate ?? toDateInputValue(plan?.endDate ?? plan?.startDate ?? plan?.date ?? null);
  const initialBanner = baseline?.bannerUrl ?? (plan?.bannerUrl ?? plan?.bannerImageUrl ?? null);

  const isValid = name.trim().length > 0 && locationText.trim().length > 0 && startDate.trim().length > 0 && endDate.trim().length > 0;
  const isDirty = useMemo(
    () => (
      name.trim() !== initialName.trim()
      || locationText.trim() !== initialLocation.trim()
      || startDate !== initialStartDate
      || endDate !== initialEndDate
      || (bannerUrlDraft ?? null) !== (initialBanner ?? null)
    ),
    [name, locationText, startDate, endDate, bannerUrlDraft, initialName, initialLocation, initialStartDate, initialEndDate, initialBanner],
  );

  const previewUrl = resolveAssetUrl(bannerUrlDraft);

  const handleClearBanner = () => {
    setBannerUrlDraft(null);
    setBannerUrlInput("");
    setBannerError(null);
    setBannerImageLoading(false);
    setBannerImageFailed(false);
  };

  const uploadBannerFile = async (file: File) => {
    if (!plan?.id) throw new Error("No plan selected");
    const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      throw new Error("Please upload JPG, PNG, or WEBP.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("Image must be 5MB or smaller.");
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Couldn’t read image file."));
      reader.readAsDataURL(file);
    });

    const response = await fetch(`/api/barbecues/${plan.id}/banner`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    });
    const payload = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      throw new Error((payload as { message?: string }).message || "Banner upload failed.");
    }
    const nextUrl = typeof (payload as { bannerImageUrl?: unknown; url?: unknown }).bannerImageUrl === "string"
      ? String((payload as { bannerImageUrl: string }).bannerImageUrl)
      : typeof (payload as { url?: unknown }).url === "string"
        ? String((payload as { url: string }).url)
        : null;
    if (!nextUrl) {
      throw new Error("Upload completed but no banner URL was returned.");
    }
    setBannerUrlDraft(nextUrl);
    setBannerError(null);
  };

  const handleBannerFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setBannerError(null);
    setUploadingBanner(true);
    try {
      await uploadBannerFile(file);
    } catch (error) {
      setBannerError((error as Error).message || "Banner upload failed.");
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleApplyUrl = () => {
    const raw = bannerUrlInput.trim();
    if (!raw) {
      handleClearBanner();
      return;
    }
    if (!/^https?:\/\//i.test(raw)) {
      setBannerError("Use a URL starting with http:// or https://");
      return;
    }
    setBannerUrlDraft(raw);
    setBannerError(null);
  };

  const handleSave = async () => {
    if (!isValid || !isDirty || saving || uploadingBanner) return;
    try {
      await onSave({
        name: name.trim(),
        locationText: locationText.trim(),
        startDate,
        endDate,
        bannerUrl: bannerUrlDraft?.trim() || null,
      });
      setBaseline({
        name: name.trim(),
        locationText: locationText.trim(),
        startDate,
        endDate,
        bannerUrl: bannerUrlDraft?.trim() || null,
      });
      onOpenChange(false);
    } catch (error) {
      toastError((error as Error).message || "Couldn’t save plan details. Try again.");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="h-full w-[420px] max-w-[92vw] border-l border-slate-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-[#121212]"
        >
          <div className="flex h-full flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
              <div className="flex items-start justify-between gap-3">
                <SheetHeader className="space-y-1 text-left">
                  <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Plan details</SheetTitle>
                  <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
                    {plan?.name || "Edit your plan"}
                  </SheetDescription>
                </SheetHeader>
                {isCreator && onDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Delete plan"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={saving || deleting}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plan-details-name">Name</Label>
                  <Input
                    id="plan-details-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Plan name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan-details-location">Location</Label>
                  <Input
                    id="plan-details-location"
                    value={locationText}
                    onChange={(event) => setLocationText(event.target.value)}
                    placeholder="Where is it happening?"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="plan-details-start-date">Start date</Label>
                    <Input
                      id="plan-details-start-date"
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setStartDate(nextValue);
                        setEndDate((current) => (!current || current < nextValue ? nextValue : current));
                      }}
                      disabled={!canEditDates}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-details-end-date">End date</Label>
                    <Input
                      id="plan-details-end-date"
                      type="date"
                      min={startDate || undefined}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      disabled={!canEditDates}
                    />
                  </div>
                </div>
                {!canEditDates ? (
                  <p className="text-xs text-muted-foreground">
                    Dates can only be changed before settlement starts.
                  </p>
                ) : null}

                <section className="space-y-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Banner</Label>
                    {bannerUrlDraft ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClearBanner}>
                        Clear
                      </Button>
                    ) : null}
                  </div>

                  <div className="relative h-28 overflow-hidden rounded-lg border border-border bg-muted/30">
                    {previewUrl ? (
                      <>
                        {bannerImageLoading ? (
                          <div className="absolute inset-0 animate-pulse bg-muted/60" />
                        ) : null}
                        {!bannerImageFailed ? (
                          <img
                            src={previewUrl}
                            alt="Banner preview"
                            className="h-full w-full object-cover"
                            onLoad={() => {
                              setBannerImageLoading(false);
                              setBannerImageFailed(false);
                            }}
                            onError={() => {
                              setBannerImageLoading(false);
                              setBannerImageFailed(true);
                            }}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            Could not load image.
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        No banner selected.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-1">
                    <Button
                      type="button"
                      variant={bannerMode === "upload" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setBannerMode("upload");
                        setBannerError(null);
                      }}
                    >
                      Upload
                    </Button>
                    <Button
                      type="button"
                      variant={bannerMode === "url" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setBannerMode("url");
                        setBannerError(null);
                      }}
                    >
                      URL
                    </Button>
                  </div>

                  {bannerMode === "upload" ? (
                    <div className="space-y-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => void handleBannerFileChange(event)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingBanner}
                      >
                        {uploadingBanner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {uploadingBanner ? "Uploading..." : "Upload image"}
                      </Button>
                      {bannerError ? (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-destructive">{bannerError}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingBanner}
                          >
                            Retry
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        value={bannerUrlInput}
                        onChange={(event) => setBannerUrlInput(event.target.value)}
                        placeholder="https://..."
                      />
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleApplyUrl}>
                          Apply
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={handleClearBanner}>
                          Clear
                        </Button>
                      </div>
                      {bannerError ? <p className="text-xs text-destructive">{bannerError}</p> : null}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  {onLeave ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setLeaveDialogOpen(true)}
                      disabled={saving || deleting || leaving}
                    >
                      Leave plan
                    </Button>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || leaving}>
                  Cancel
                  </Button>
                  <Button type="button" onClick={() => void handleSave()} disabled={!isValid || !isDirty || saving || deleting || leaving || uploadingBanner}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                    Save changes
                  </Button>
                </div>
              </div>
            </footer>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the plan and its data. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                if (!onDelete) return;
                void Promise.resolve(onDelete())
                  .then(() => {
                    setDeleteDialogOpen(false);
                    onOpenChange(false);
                  })
                  .catch(() => {
                    // Keep dialog open for retry.
                  });
              }}
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCreator
                ? (
                  willDeleteOnLeave
                    ? "You are the creator and the last member. Leaving will permanently delete this plan."
                    : `You are the creator. Ownership will transfer to ${leaveTransferTargetName ?? "the next member"} when you leave.`
                )
                : "You will lose access to this plan and its chat, expenses, and crew details."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leaving}
              onClick={(event) => {
                event.preventDefault();
                if (!onLeave) return;
                void Promise.resolve(onLeave())
                  .then(() => {
                    setLeaveDialogOpen(false);
                    onOpenChange(false);
                  })
                  .catch(() => {
                    // Keep dialog open for retry.
                  });
              }}
            >
              {leaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Leave plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default PlanDetailsDrawer;
