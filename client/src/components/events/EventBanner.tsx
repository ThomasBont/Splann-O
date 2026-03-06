import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Barbecue } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Pencil, RotateCcw, Upload } from "lucide-react";
import {
  EVENT_BANNER_PRESETS,
  getEventBanner,
  getBannerPresetClass,
  type EventBannerPresetId,
} from "@/lib/event-banner";
import { circularActionButtonClass } from "@/lib/utils";

type EventBannerProps = {
  event: Barbecue;
  editable?: boolean;
  variant?: "private" | "public";
  templateFallbackClassName: string;
  templateLabel: string;
  templateEmoji: string;
  onUpload?: (dataUrl: string) => Promise<void>;
  onSelectPreset?: (presetId: EventBannerPresetId) => Promise<void>;
  onReset?: () => Promise<void>;
  className?: string;
};

const MAX_BANNER_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function EventBanner({
  event,
  editable = false,
  variant = "private",
  templateFallbackClassName,
  templateLabel,
  templateEmoji,
  onUpload,
  onSelectPreset,
  onReset,
  className,
}: EventBannerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [localPresetId, setLocalPresetId] = useState<EventBannerPresetId | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!pending) {
      setLocalPreviewUrl(null);
      setLocalPresetId(null);
    }
  }, [event.bannerImageUrl, event.templateData, pending]);

  const { uploadedUrl, presetId: persistedPresetId } = getEventBanner(event);
  const activePresetId = localPresetId ?? persistedPresetId;
  const presetClass = getBannerPresetClass(activePresetId);

  useEffect(() => {
    setImageLoaded(false);
  }, [uploadedUrl, localPreviewUrl, event.id]);

  const renderMode = useMemo(() => {
    if (localPreviewUrl || uploadedUrl) return "image" as const;
    if (presetClass) return "preset" as const;
    return "fallback" as const;
  }, [uploadedUrl, localPreviewUrl, presetClass]);

  const imageSrc = localPreviewUrl ?? uploadedUrl ?? null;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0] ?? null;
    evt.target.value = "";
    if (!file || !onUpload) return;
    if (!ACCEPTED_TYPES.has(file.type.toLowerCase())) return;
    if (file.size > MAX_BANNER_FILE_SIZE_BYTES) return;
    const dataUrl = await readFileAsDataUrl(file);
    setLocalPreviewUrl(dataUrl);
    setPending(true);
    try {
      await onUpload(dataUrl);
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  const handleSelectPreset = async (presetId: EventBannerPresetId) => {
    if (!onSelectPreset) return;
    setLocalPresetId(presetId);
    setPending(true);
    try {
      await onSelectPreset(presetId);
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  const handleReset = async () => {
    if (!onReset) return;
    setPending(true);
    try {
      await onReset();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`relative rounded-2xl border border-border/60 overflow-hidden shadow-sm ${className ?? ""}`}>
      {renderMode === "image" && imageSrc ? (
        <div className="relative h-36 sm:h-44 transition-opacity duration-[240ms]">
          <img
            src={imageSrc}
            alt={event.name}
            onLoad={() => setImageLoaded(true)}
            className={`h-full w-full object-cover transition-opacity duration-200 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className={`h-36 sm:h-44 px-5 py-4 flex items-end justify-between transition-colors duration-[240ms] ${presetClass ?? templateFallbackClassName}`}>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground/90">
              {variant === "private" ? "Private event" : "Event"}
            </p>
            <p className="text-sm font-semibold mt-1">{templateLabel}</p>
          </div>
          <div className="text-4xl sm:text-5xl leading-none" aria-hidden>
            {templateEmoji}
          </div>
        </div>
      )}

      {pending && (
        <div className="absolute inset-0 bg-background/35 backdrop-blur-[1px] grid place-items-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground/80" />
        </div>
      )}

      {editable && variant === "private" && (
        <div className="absolute left-3 top-3 sm:left-4 sm:top-4">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <Popover open={open} onOpenChange={setOpen}>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={`${circularActionButtonClass()} h-8 w-8 backdrop-blur hover:scale-105`}
                      aria-label="Change banner"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">Change banner</TooltipContent>
                <PopoverContent align="start" sideOffset={10} className="w-[290px] p-3 space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Change banner</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Upload an image, pick a preset, or reset to the default look.</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button type="button" variant="outline" size="sm" className="w-full justify-start" onClick={handleUploadClick} disabled={pending || !onUpload}>
                    <Upload className="w-3.5 h-3.5 mr-2" />
                    Upload image
                  </Button>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Choose preset</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {EVENT_BANNER_PRESETS.map((preset) => (
                        <button
                          key={`event-banner-preset-${preset.id}`}
                          type="button"
                          className={`h-8 rounded-md border border-border/60 transition-transform duration-[160ms] hover:scale-[1.03] ${preset.className} ${activePresetId === preset.id ? "ring-2 ring-primary/35" : ""}`}
                          onClick={() => handleSelectPreset(preset.id)}
                          disabled={pending || !onSelectPreset}
                          title={preset.label}
                          aria-label={`Use ${preset.label} banner`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-muted-foreground"
                    onClick={handleReset}
                    disabled={pending || !onReset}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                    Reset to default
                  </Button>
                </PopoverContent>
              </Popover>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
