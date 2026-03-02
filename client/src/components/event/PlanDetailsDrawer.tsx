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
  bannerImageUrl: string | null;
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
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function PlanDetailsDrawer({ open, onOpenChange, plan, saving = false, onSave }: PlanDetailsDrawerProps) {
  const { toastError } = useAppToast();
  const [name, setName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [dateTimeLocal, setDateTimeLocal] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [useBannerUrlInput, setUseBannerUrlInput] = useState(false);
  const [bannerUploadFile, setBannerUploadFile] = useState<File | null>(null);
  const [bannerUploadPreviewUrl, setBannerUploadPreviewUrl] = useState<string | null>(null);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const [bannerUploadPending, setBannerUploadPending] = useState(false);
  const [removeBannerRequested, setRemoveBannerRequested] = useState(false);
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
    setDateTimeLocal(toDateTimeLocalValue(plan.date));
    setBannerImageUrl(plan.bannerImageUrl ?? "");
    setUseBannerUrlInput(false);
    setBannerUploadFile(null);
    setBannerUploadError(null);
    setRemoveBannerRequested(false);
    setBannerUploadPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [open, plan]);

  const initialName = plan?.name ?? "";
  const initialLocation = plan?.locationText?.trim()
    || plan?.locationName?.trim()
    || [plan?.city, plan?.countryName].filter(Boolean).join(", ").trim()
    || "";
  const initialDate = toDateTimeLocalValue(plan?.date ?? null);
  const initialBanner = plan?.bannerImageUrl ?? "";
  const normalizedBannerImageUrl = useMemo(() => normalizeBannerUrl(bannerImageUrl), [bannerImageUrl]);
  const bannerPreviewUrl = bannerUploadPreviewUrl || normalizedBannerImageUrl || "";
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

  const isValid = name.trim().length > 0 && locationText.trim().length > 0 && dateTimeLocal.trim().length > 0;
  const isDirty = useMemo(
    () => (
      name.trim() !== initialName.trim()
      || locationText.trim() !== initialLocation.trim()
      || dateTimeLocal !== initialDate
      || !!bannerUploadFile
      || removeBannerRequested
      || normalizedBannerImageUrl !== normalizeBannerUrl(initialBanner)
    ),
    [name, locationText, dateTimeLocal, bannerUploadFile, removeBannerRequested, normalizedBannerImageUrl, initialName, initialLocation, initialDate, initialBanner],
  );

  const handleSave = async () => {
    if (!isValid || !isDirty || saving) return;
    try {
      const isoDate = new Date(dateTimeLocal).toISOString();
      let nextBannerImageUrl: string | null = null;
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
        nextBannerImageUrl = String((uploadPayload as { bannerImageUrl?: string }).bannerImageUrl ?? "");
        if (!nextBannerImageUrl) {
          throw new Error("Banner image URL could not be saved.");
        }
      } else if (removeBannerRequested) {
        nextBannerImageUrl = null;
      } else if (normalizedBannerImageUrl) {
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
      } else {
        nextBannerImageUrl = null;
      }
      const payload = {
        name: name.trim(),
        locationText: locationText.trim(),
        date: isoDate,
        bannerImageUrl: nextBannerImageUrl,
      };
      if (import.meta.env.DEV) {
        console.debug("[plan-details-save] payload", payload);
      }
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
      setBannerImageUrl(nextBannerImageUrl ?? "");
    } catch (error) {
      setBannerUploadPending(false);
      toastError((error as Error).message || "Couldn’t save plan details. Try again.");
    }
  };

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
                      <img
                        src={bannerPreviewUrl}
                        alt="Banner preview"
                        className="aspect-video w-full object-cover"
                      />
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
                    {(normalizedBannerImageUrl || plan?.bannerImageUrl) && !bannerUploadFile ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        onClick={() => {
                          setBannerImageUrl("");
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
