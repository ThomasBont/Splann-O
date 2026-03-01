import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
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
  }, [open, plan]);

  const initialName = plan?.name ?? "";
  const initialLocation = plan?.locationText?.trim()
    || plan?.locationName?.trim()
    || [plan?.city, plan?.countryName].filter(Boolean).join(", ").trim()
    || "";
  const initialDate = toDateTimeLocalValue(plan?.date ?? null);
  const initialBanner = plan?.bannerImageUrl ?? "";
  const normalizedBannerImageUrl = useMemo(() => normalizeBannerUrl(bannerImageUrl), [bannerImageUrl]);

  const isValid = name.trim().length > 0 && locationText.trim().length > 0 && dateTimeLocal.trim().length > 0;
  const isDirty = useMemo(
    () => (
      name.trim() !== initialName.trim()
      || locationText.trim() !== initialLocation.trim()
      || dateTimeLocal !== initialDate
      || normalizedBannerImageUrl !== normalizeBannerUrl(initialBanner)
    ),
    [name, locationText, dateTimeLocal, normalizedBannerImageUrl, initialName, initialLocation, initialDate, initialBanner],
  );

  const handleSave = async () => {
    if (!isValid || !isDirty || saving) return;
    try {
      const isoDate = new Date(dateTimeLocal).toISOString();
      if (normalizedBannerImageUrl) {
        let candidate: URL;
        try {
          candidate = new URL(normalizedBannerImageUrl);
        } catch {
          throw new Error("Enter a valid banner image URL.");
        }
        if (candidate.protocol !== "http:" && candidate.protocol !== "https:") {
          throw new Error("Banner image URL must start with http:// or https://");
        }
      }
      const payload = {
        name: name.trim(),
        locationText: locationText.trim(),
        date: isoDate,
        bannerImageUrl: normalizedBannerImageUrl || null,
      };
      if (import.meta.env.DEV) {
        console.debug("[plan-details-save] payload", payload);
      }
      await onSave(payload);
    } catch (error) {
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
                <Label htmlFor="plan-details-banner">Banner image URL</Label>
                <Input
                  id="plan-details-banner"
                  type="url"
                  value={bannerImageUrl}
                  onChange={(event) => setBannerImageUrl(event.target.value)}
                  placeholder="https://..."
                />
                {normalizedBannerImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-700">
                    <img
                      src={normalizedBannerImageUrl}
                      alt="Banner preview"
                      className="h-32 w-full object-cover"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <footer className="border-t border-slate-200 bg-white px-5 py-3 dark:border-neutral-800 dark:bg-[#121212]">
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={!isValid || !isDirty || saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
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
