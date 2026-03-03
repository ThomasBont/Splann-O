import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
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
import { resolveAssetUrl, withCacheBust } from "@/lib/asset-url";

type PlanDetailsValues = {
  name: string;
  locationText: string;
  date: string;
  bannerImageUrl?: string | null;
  bannerAssetId?: string | null;
};

type BannerMode = "upload" | "url";

type PlanDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    id?: number;
    name: string;
    date: string | Date | null;
    locationText?: string | null;
    locationName?: string | null;
    city?: string | null;
    countryName?: string | null;
    bannerImageUrl?: string | null;
    bannerAssetId?: string | null;
  } | null;
  saving?: boolean;
  onSave: (updates: PlanDetailsValues) => Promise<void>;
  isCreator?: boolean;
  deleting?: boolean;
  onDelete?: () => Promise<void> | void;
};

function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offsetMs);
  return local.toISOString().slice(0, 16);
}

function normalizeBannerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^blob:/i.test(trimmed)) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return "";
  if (trimmed.startsWith("/")) return trimmed;
  return `https://${trimmed}`;
}

function isAbsoluteHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isBannerPathOrUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return trimmed.startsWith("/") || isAbsoluteHttpUrl(trimmed);
}

function toVersionToken(value: string | number | Date | null | undefined): string | number | null {
  if (value instanceof Date) return value.getTime();
  return value ?? null;
}

export function PlanDetailsDrawer({
  open,
  onOpenChange,
  plan,
  saving = false,
  onSave,
  isCreator = false,
  deleting = false,
  onDelete,
}: PlanDetailsDrawerProps) {
  const { toastError } = useAppToast();
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [dateTimeLocal, setDateTimeLocal] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerUrlDraft, setBannerUrlDraft] = useState("");
  const [bannerAssetId, setBannerAssetId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ name: string; locationText: string; dateTimeLocal: string; bannerImageUrl: string; bannerAssetId: string | null; bannerUrlDraft: string } | null>(null);
  const [bannerMode, setBannerMode] = useState<BannerMode>("upload");
  const [bannerUploadFile, setBannerUploadFile] = useState<File | null>(null);
  const [bannerUploadPreviewUrl, setBannerUploadPreviewUrl] = useState<string | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploadPending, setBannerUploadPending] = useState(false);
  const [removeBannerRequested, setRemoveBannerRequested] = useState(false);
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [bannerPreviewLoaded, setBannerPreviewLoaded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const initializedPlanIdRef = useRef<number | null>(null);

  const clearUploadSelection = () => {
    setBannerUploadFile(null);
    setBannerUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    if (!open || !plan) return;
    const planId = Number.isInteger(plan.id) ? Number(plan.id) : null;
    if (initializedPlanIdRef.current === planId) return;
    initializedPlanIdRef.current = planId;
    setName(plan.name ?? "");
    setLocationText(
      plan.locationText?.trim()
      || plan.locationName?.trim()
      || [plan.city, plan.countryName].filter(Boolean).join(", ").trim()
      || "",
    );
    const nextDateTime = toDateTimeLocalValue(plan.date);
    const nextBanner = plan.bannerImageUrl ?? "";
    const nextBannerMode: BannerMode = /^https?:\/\//i.test(nextBanner)
      ? "url"
      : (plan.bannerAssetId ? "upload" : "upload");
    const nextBannerUrlDraft = nextBannerMode === "url" ? nextBanner : "";
    setDateTimeLocal(nextDateTime);
    setBannerImageUrl(nextBanner);
    setBannerUrlDraft(nextBannerUrlDraft);
    setBannerAssetId(plan.bannerAssetId ?? null);
    setBaseline({
      name: plan.name ?? "",
      locationText:
        plan.locationText?.trim()
        || plan.locationName?.trim()
        || [plan.city, plan.countryName].filter(Boolean).join(", ").trim()
        || "",
      dateTimeLocal: nextDateTime,
      bannerImageUrl: nextBanner,
      bannerAssetId: plan.bannerAssetId ?? null,
      bannerUrlDraft: nextBannerUrlDraft,
    });
    setBannerMode(nextBannerMode);
    clearUploadSelection();
    setBannerUploadError(null);
    setRemoveBannerRequested(false);
    setBannerPreviewFailed(false);
    setBannerPreviewLoaded(false);
  }, [open, plan?.id]);

  useEffect(() => {
    if (!open) {
      initializedPlanIdRef.current = null;
      setDeleteDialogOpen(false);
      setDeleteConfirmName("");
    }
  }, [open]);

  const initialName = baseline?.name ?? plan?.name ?? "";
  const initialLocation = baseline?.locationText
    ?? (
      plan?.locationText?.trim()
      || plan?.locationName?.trim()
      || [plan?.city, plan?.countryName].filter(Boolean).join(", ").trim()
      || ""
    );
  const initialDate = baseline?.dateTimeLocal ?? toDateTimeLocalValue(plan?.date ?? null);
  const initialBanner = baseline?.bannerImageUrl ?? plan?.bannerImageUrl ?? "";
  const initialBannerAssetId = baseline?.bannerAssetId ?? plan?.bannerAssetId ?? null;
  const initialBannerUrlDraft = baseline?.bannerUrlDraft ?? "";
  const normalizedBannerImageUrl = useMemo(() => normalizeBannerUrl(bannerImageUrl), [bannerImageUrl]);
  const resolvedAssetBannerUrl = useMemo(
    () => (bannerAssetId ? `/api/assets/${encodeURIComponent(bannerAssetId)}` : ""),
    [bannerAssetId],
  );
  const urlInputTrimmed = bannerUrlDraft.trim();
  const bannerPreviewUrl = bannerUploadPreviewUrl
    || (bannerMode === "url"
      ? (urlInputTrimmed ? (resolveAssetUrl(urlInputTrimmed) || "") : "")
      : (resolveAssetUrl(resolvedAssetBannerUrl) || ""))
    || "";
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleBannerFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setBannerUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBannerUploadError("Banner image must be 5MB or smaller.");
      return;
    }
    setBannerUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setBannerUploadFile(file);
    setBannerUploadError(null);
    setBannerMode("upload");
    setRemoveBannerRequested(false);
  };

  useEffect(() => {
    return () => {
      if (bannerUploadPreviewUrl) URL.revokeObjectURL(bannerUploadPreviewUrl);
    };
  }, [bannerUploadPreviewUrl]);

  useEffect(() => {
    setBannerPreviewFailed(false);
    setBannerPreviewLoaded(false);
  }, [bannerPreviewUrl]);

  const isValid = name.trim().length > 0 && locationText.trim().length > 0 && dateTimeLocal.trim().length > 0;
  const isBannerValid = !bannerUploadError;
  const bannerDirty = useMemo(() => {
    if (bannerMode === "upload") {
      return !!bannerUploadFile || removeBannerRequested;
    }
    return bannerUrlDraft.trim() !== initialBannerUrlDraft.trim();
  }, [bannerMode, bannerUploadFile, removeBannerRequested, bannerUrlDraft, initialBannerUrlDraft]);
  const canConfirmDelete = !!plan?.name && deleteConfirmName.trim() === plan.name.trim();
  const isDirty = useMemo(
    () => (
      name.trim() !== initialName.trim()
      || locationText.trim() !== initialLocation.trim()
      || dateTimeLocal !== initialDate
      || bannerDirty
    ),
    [name, locationText, dateTimeLocal, bannerDirty, initialName, initialLocation, initialDate],
  );

  const handleSave = async () => {
    if (!isValid || !isDirty || !isBannerValid || saving) return;
    try {
      const isoDate = new Date(dateTimeLocal).toISOString();
      let nextBannerImageUrl: string | null | undefined = undefined;
      let nextBannerAssetId: string | null | undefined = undefined;
      if (bannerMode === "upload") {
        if (bannerUploadFile) {
          setBannerUploadPending(true);
          if (!plan?.id) throw new Error("No plan selected.");
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = typeof reader.result === "string" ? reader.result : null;
              if (!result || !result.startsWith("data:image/")) {
                reject(new Error("Please choose a valid image file."));
                return;
              }
              resolve(result);
            };
            reader.onerror = () => reject(new Error("Please choose a valid image file."));
            reader.readAsDataURL(bannerUploadFile);
          });
          const uploadRes = await fetch(`/api/barbecues/${plan.id}/banner`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ dataUrl }),
          });
          const uploadPayload = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok) {
            throw new Error((uploadPayload as { message?: string }).message || "Couldn’t upload banner image.");
          }
          const uploadedPath = String((uploadPayload as { path?: string; url?: string }).path ?? (uploadPayload as { url?: string }).url ?? "").trim();
          const uploadedAssetId = String((uploadPayload as { assetId?: string }).assetId ?? "").trim();
          if (!isBannerPathOrUrl(uploadedPath) && uploadedAssetId.length === 0) {
            throw new Error("Banner image URL could not be saved.");
          }
          nextBannerImageUrl = null;
          nextBannerAssetId = uploadedAssetId || null;
        } else if (removeBannerRequested) {
          nextBannerImageUrl = null;
          nextBannerAssetId = null;
        }
      } else {
        if (urlInputTrimmed.length === 0) {
          nextBannerImageUrl = null;
          nextBannerAssetId = null;
        } else {
          const importUrl = /^https?:\/\//i.test(urlInputTrimmed) ? urlInputTrimmed : `https://${urlInputTrimmed}`;
          if (!isAbsoluteHttpUrl(importUrl)) throw new Error("Enter a valid banner image URL.");
          const importRes = await fetch("/api/media/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ url: importUrl }),
          });
          const importPayload = await importRes.json().catch(() => ({}));
          if (!importRes.ok) {
            throw new Error((importPayload as { message?: string }).message || "Couldn’t import image from URL.");
          }
          const storedUrl = String((importPayload as { storedUrl?: string; path?: string; url?: string }).storedUrl
            ?? (importPayload as { path?: string; url?: string }).path
            ?? (importPayload as { url?: string }).url
            ?? "").trim();
          if (!isBannerPathOrUrl(storedUrl)) {
            throw new Error("Couldn’t import image from URL.");
          }
          nextBannerImageUrl = storedUrl;
          nextBannerAssetId = null;
        }
      }
      const payload: PlanDetailsValues = {
        name: name.trim(),
        locationText: locationText.trim(),
        date: isoDate,
      };
      if (nextBannerImageUrl !== undefined) payload.bannerImageUrl = nextBannerImageUrl;
      if (nextBannerAssetId !== undefined) payload.bannerAssetId = nextBannerAssetId;
      await onSave(payload);
      setBannerUploadPending(false);
      clearUploadSelection();
      setBannerUploadError(null);
      setRemoveBannerRequested(false);
      const savedBanner = nextBannerImageUrl !== undefined ? (nextBannerImageUrl ?? "") : initialBanner;
      const savedAsset = nextBannerAssetId !== undefined ? nextBannerAssetId : initialBannerAssetId;
      setBannerImageUrl(savedBanner);
      setBannerUrlDraft(savedBanner && /^https?:\/\//i.test(savedBanner) ? savedBanner : "");
      setBannerAssetId(savedAsset);
      setBaseline({
        name: name.trim(),
        locationText: locationText.trim(),
        dateTimeLocal,
        bannerImageUrl: savedBanner,
        bannerAssetId: savedAsset,
        bannerUrlDraft: savedBanner && /^https?:\/\//i.test(savedBanner) ? savedBanner : "",
      });
      onOpenChange(false);
    } catch (error) {
      setBannerUploadPending(false);
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
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-lg font-semibold text-slate-900 dark:text-neutral-100">Plan details</SheetTitle>
              <SheetDescription className="text-sm text-slate-500 dark:text-neutral-400">
                {plan?.name || "Edit your plan"}
              </SheetDescription>
            </SheetHeader>
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

              <div className="space-y-2">
                <Label htmlFor="plan-details-datetime">Date & time</Label>
                <Input
                  id="plan-details-datetime"
                  type="datetime-local"
                  value={dateTimeLocal}
                  onChange={(event) => setDateTimeLocal(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Banner image</Label>
                <input
                  ref={bannerFileInputRef}
                  id="plan-details-banner-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    handleBannerFileChange(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                  {bannerPreviewUrl ? (
                    <div className="overflow-hidden rounded-lg border border-border/70">
                      {bannerPreviewFailed ? (
                        <div className="grid aspect-video w-full place-items-center bg-muted/40 text-xs text-muted-foreground">
                          Banner failed to load
                        </div>
                      ) : (
                        <>
                          {!bannerPreviewLoaded ? (
                            <div className="grid aspect-video w-full place-items-center bg-muted/30 text-xs text-muted-foreground">
                              Loading banner…
                            </div>
                          ) : null}
                          <img
                            src={withCacheBust(
                              bannerPreviewUrl,
                              toVersionToken((plan as { updatedAt?: string | Date | null } | null)?.updatedAt ?? plan?.id),
                            ) ?? ""}
                            alt="Banner preview"
                            className={`aspect-video w-full object-cover ${bannerPreviewLoaded ? "block" : "hidden"}`}
                            onLoad={() => setBannerPreviewLoaded(true)}
                            onError={() => {
                              setBannerPreviewFailed(true);
                              console.error("BANNER_LOAD_FAILED", bannerPreviewUrl);
                            }}
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="grid aspect-video w-full place-items-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-xs text-muted-foreground">
                      No banner selected
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {bannerMode === "upload" ? (
                      <Button
                        type="button"
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => bannerFileInputRef.current?.click()}
                        aria-label="Upload banner"
                      >
                        <Upload className="mr-1.5 h-4 w-4" />
                        Upload banner
                      </Button>
                    ) : null}
                    {bannerUploadFile ? (
                      <>
                        <span className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {bannerUploadFile.name} · {formatFileSize(bannerUploadFile.size)}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          onClick={() => {
                            setBannerUploadFile(null);
                            setBannerUploadPreviewUrl((prev) => {
                              if (prev) URL.revokeObjectURL(prev);
                              return null;
                            });
                          }}
                        >
                          Remove
                        </button>
                      </>
                    ) : null}
                    {(normalizedBannerImageUrl || resolvedAssetBannerUrl || plan?.bannerImageUrl) && !bannerUploadFile ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        onClick={() => {
                          setBannerMode("upload");
                          setBannerImageUrl("");
                          setBannerUrlDraft("");
                          setBannerAssetId(null);
                          setRemoveBannerRequested(true);
                          setBannerUploadError(null);
                          clearUploadSelection();
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="w-fit text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => {
                      const nextMode: BannerMode = bannerMode === "url" ? "upload" : "url";
                      setBannerMode(nextMode);
                      setBannerUploadError(null);
                      setRemoveBannerRequested(false);
                      if (nextMode === "url") {
                        clearUploadSelection();
                        setBannerUrlDraft((prev) => prev || (bannerImageUrl && /^https?:\/\//i.test(bannerImageUrl) ? bannerImageUrl : ""));
                      } else {
                        setBannerUrlDraft("");
                      }
                    }}
                  >
                    {bannerMode === "url" ? "Hide URL input" : "Use URL instead"}
                  </button>
                  {bannerMode === "url" ? (
                    <Input
                      id="plan-details-banner"
                      type="url"
                      value={bannerUrlDraft}
                      onChange={(event) => {
                        setBannerUrlDraft(event.target.value);
                        setBannerAssetId(null);
                        clearUploadSelection();
                        setBannerUploadError(null);
                        setRemoveBannerRequested(false);
                      }}
                      placeholder="https://example.com/image.jpg"
                    />
                  ) : null}
                  {bannerUploadError ? (
                    <p className="text-xs text-destructive">{bannerUploadError}</p>
                  ) : null}
                </div>
              </div>

              {isCreator && onDelete ? (
                <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive">Danger zone</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permanently delete this plan, including shared costs, chat, and crew data.
                  </p>
                  <div className="mt-3">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={saving || deleting}
                    >
                      Delete plan
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={!isValid || !isDirty || !isBannerValid || saving || bannerUploadPending}>
                {saving || bannerUploadPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </footer>
        </div>
      </SheetContent>
      </Sheet>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the plan and all related data (expenses, chat, members). This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-plan-confirm-name">Type the plan name to confirm</Label>
            <Input
              id="delete-plan-confirm-name"
              value={deleteConfirmName}
              onChange={(event) => setDeleteConfirmName(event.target.value)}
              placeholder={plan?.name ?? "Plan name"}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!canConfirmDelete || deleting}
              onClick={(event) => {
                event.preventDefault();
                if (!canConfirmDelete || !onDelete) return;
                void Promise.resolve(onDelete())
                  .then(() => {
                    setDeleteDialogOpen(false);
                    setDeleteConfirmName("");
                  })
                  .catch(() => {
                    // Keep the dialog open so the user can retry after an API error.
                  });
              }}
            >
              {deleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default PlanDetailsDrawer;
