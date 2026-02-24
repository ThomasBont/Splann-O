"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { EventRecapCard } from "./event-recap-card";
import { downloadCardAsImage, copyImageToClipboard } from "@/utils/exportCard";
import type { RecapCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";
import { Share2, Copy, Download } from "lucide-react";

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

export interface ShareRecapActionsProps {
  data: RecapCardData;
  theme?: ThemeToken;
  shareImageLabel?: string;
  copyImageLabel?: string;
  downloadLabel?: string;
  onCopySuccess?: () => void;
}

/** Small secondary actions for sharing an event recap card. */
export function ShareRecapActions({
  data,
  theme,
  shareImageLabel = "Share image",
  copyImageLabel = "Copy image",
  downloadLabel = "Download",
  onCopySuccess,
}: ShareRecapActionsProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const ok = await copyImageToClipboard(cardRef.current);
      if (ok) onCopySuccess?.();
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      await downloadCardAsImage(cardRef.current, "splanno-recap-card.png");
    } finally {
      setBusy(false);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const ok = await copyImageToClipboard(cardRef.current);
      if (ok && typeof navigator !== "undefined" && navigator.share) {
        const dataUrl = await import("html-to-image").then((m) =>
          m.toPng(cardRef.current!, { cacheBust: true, pixelRatio: 2, backgroundColor: "#1a1a1e" })
        );
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], "splanno-recap-card.png", { type: "image/png" });
        await navigator.share({
          title: `${data.eventName} — Recap`,
          text: `Split smart with Splanno`,
          files: [file],
        });
      } else if (ok) {
        onCopySuccess?.();
      }
    } finally {
      setBusy(false);
    }
  };

  if (!ENABLE_SHARING) return null;

  return (
    <>
      <div
        ref={cardRef}
        className="absolute -left-[9999px] -top-[9999px] w-[400px]"
        aria-hidden
      >
        <EventRecapCard data={data} theme={theme} exportMode />
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleShare}
          disabled={busy}
        >
          <Share2 className="w-3 h-3 mr-1" />
          {shareImageLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
          disabled={busy}
        >
          <Copy className="w-3 h-3 mr-1" />
          {copyImageLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={handleDownload}
          disabled={busy}
        >
          <Download className="w-3 h-3 mr-1" />
          {downloadLabel}
        </Button>
      </div>
    </>
  );
}
