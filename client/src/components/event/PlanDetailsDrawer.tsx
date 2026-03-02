import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppToast } from "@/hooks/use-app-toast";

type PlanDetailsValues = {
  name: string;
  locationText: string;
  date: string;
  bannerImageUrl?: string | null;
  bannerAssetId?: string | null;
};

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
  if (trimmed.startsWith("/") && typeof window !== "undefined") {
    return new URL(trimmed, window.location.origin).toString();
  }
  return `https://${trimmed}`;
}

export function PlanDetailsDrawer({ open, onOpenChange, plan, saving = false, onSave }: PlanDetailsDrawerProps) {
  const { toastError } = useAppToast();
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [dateTimeLocal, setDateTimeLocal] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerAssetId, setBannerAssetId] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ name: string; locationText: string; dateTimeLocal: string; bannerImageUrl: string } | null>(null);
  const [useBannerUrlInput, setUseBannerUrlInput] = useState(false);
  const [bannerUploadFile, setBannerUploadFile] = useState<File | null>(null);
  const [bannerUploadPreviewUrl, setBannerUploadPreviewUrl] = useState<string | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploadPending, setBannerUploadPending] = useState(false);
  const [removeBannerRequested, setRemoveBannerRequested] = useState(false);
  const [bannerPreviewFailed, setBannerPreviewFailed] = useState(false);
  const [bannerPreviewLoaded, setBannerPreviewLoaded] = useState(false);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !plan) return;
    setName(plan.name ?? "");
    setLocationText(
      plan.locationText?.trim()
      || plan.locationName?.trim()
      || [plan.city, plan.countryName].filter(Boolean).join(", ").trim()
      || "",
    );
    const nextDateTime = toDateTimeLocalValue(plan.date);
    const nextBanner = plan.bannerImageUrl ?? "";
    setDateTimeLocal(nextDateTime);
    setBannerImageUrl(nextBanner);
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
    });
    setUseBannerUrlInput(false);
    setBannerUploadFile(null);
    setBannerUploadError(null);
    setRemoveBannerRequested(false);
    setBannerPreviewFailed(false);
    setBannerPreviewLoaded(false);
    setBannerUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, plan]);

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
  const normalizedInitialBannerImageUrl = useMemo(() => normalizeBannerUrl(initialBanner), [initialBanner]);
  const normalizedBannerImageUrl = useMemo(() => normalizeBannerUrl(bannerImageUrl), [bannerImageUrl]);
  const resolvedAssetBannerUrl = useMemo(
    () => (bannerAssetId ? `/api/assets/${encodeURIComponent(bannerAssetId)}` : ""),
    [bannerAssetId],
  );
  const bannerPreviewUrl = bannerUploadPreviewUrl || normalizedBannerImageUrl || resolvedAssetBannerUrl || "";
  const hasUrlInputValue = useMemo(
    () => useBannerUrlInput && bannerImageUrl.trim().length > 0,
    [useBannerUrlInput, bannerImageUrl],
  );
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
    setUseBannerUrlInput(false);
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
  const isDirty = useMemo(
    () => (
      name.trim() !== initialName.trim()
      || locationText.trim() !== initialLocation.trim()
      || dateTimeLocal !== initialDate
      || !!bannerUploadFile
      || removeBannerRequested
      || (hasUrlInputValue && normalizedBannerImageUrl !== normalizedInitialBannerImageUrl)
    ),
    [name, locationText, dateTimeLocal, bannerUploadFile, removeBannerRequested, hasUrlInputValue, normalizedBannerImageUrl, normalizedInitialBannerImageUrl, initialName, initialLocation, initialDate],
  );

  const handleSave = async () => {
    if (!isValid || !isDirty || saving) return;
    try {
      const isoDate = new Date(dateTimeLocal).toISOString();
      let nextBannerImageUrl: string | null | undefined = undefined;
      let nextBannerAssetId: string | null | undefined = undefined;
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
        const uploadedAssetId = String((uploadPayload as { assetId?: string }).assetId ?? "").trim();
        if (!uploadedAssetId) {
          throw new Error("Banner image URL could not be saved.");
        }
        nextBannerAssetId = uploadedAssetId;
        nextBannerImageUrl = null;
      } else if (removeBannerRequested) {
        nextBannerImageUrl = null;
        nextBannerAssetId = null;
      } else if (hasUrlInputValue) {
        let candidate: URL;
        try {
          candidate = new URL(normalizedBannerImageUrl);
        } catch {
          throw new Error("Enter a valid banner image URL.");
        }
        if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
          throw new Error("Banner image URL must start with http:// or https://");
        }
        nextBannerImageUrl = normalizedBannerImageUrl;
        nextBannerAssetId = null;
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
      setBannerUploadFile(null);
      setBannerUploadError(null);
      setRemoveBannerRequested(false);
      setUseBannerUrlInput(false);
      setBannerUploadPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const savedBanner = nextBannerImageUrl ?? normalizedInitialBannerImageUrl;
      setBannerImageUrl(savedBanner);
      if (nextBannerAssetId !== undefined) setBannerAssetId(nextBannerAssetId);
      setBaseline({
        name: name.trim(),
        locationText: locationText.trim(),
        dateTimeLocal,
        bannerImageUrl: savedBanner,
      });
    } catch (error) {
      setBannerUploadPending(false);
      toastError((error as Error).message || "Couldn’t save plan details. Try again.");
    }
  };

  const debugBannerUrl = bannerUploadFile ? "" : (normalizedBannerImageUrl || resolvedAssetBannerUrl || plan?.bannerImageUrl || "");

  return (
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
                            src={bannerPreviewUrl}
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
                          setBannerImageUrl("");
                          setBannerAssetId(null);
                          setRemoveBannerRequested(true);
                          setBannerUploadError(null);
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
                      setUseBannerUrlInput((prev) => !prev);
                      setBannerUploadError(null);
                    }}
                  >
                    {useBannerUrlInput ? "Hide URL input" : "Use URL instead"}
                  </button>
                  {useBannerUrlInput ? (
                    <Input
                      id="plan-details-banner"
                      type="url"
                      value={bannerImageUrl}
                      onChange={(event) => {
                        setBannerImageUrl(event.target.value);
                        setBannerAssetId(null);
                        setBannerUploadFile(null);
                        setBannerUploadPreviewUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                        setBannerUploadError(null);
                        setRemoveBannerRequested(false);
                      }}
                      placeholder="https://..."
                    />
                  ) : null}
                  {bannerUploadError ? (
                    <p className="text-xs text-destructive">{bannerUploadError}</p>
                  ) : null}
                  {import.meta.env.DEV ? (
                    <div className="space-y-1">
                      <p className="break-all text-[10px] text-muted-foreground">
                        {debugBannerUrl || "No persisted banner URL"}
                      </p>
                      {debugBannerUrl ? (
                        <a
                          href={debugBannerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          Open image
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={!isValid || !isDirty || saving || bannerUploadPending}>
                {saving || bannerUploadPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PlanDetailsDrawer;
