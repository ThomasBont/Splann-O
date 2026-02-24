"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettleCard } from "./settle-card";
import { downloadCardAsImage, copyImageToClipboard } from "@/utils/exportCard";
import type { SettleCardData } from "@/utils/shareCard";
import type { ThemeToken } from "@/theme/eventThemes";
import { Share2, Copy, Download } from "lucide-react";

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

export interface ShareSettlementActionsProps {
  data: SettleCardData;
  theme?: ThemeToken;
  shareImageLabel?: string;
  copyImageLabel?: string;
  downloadLabel?: string;
  onCopySuccess?: () => void;
}

/** Small secondary actions for sharing a settle card. */
export function ShareSettlementActions({
  data,
  theme,
  shareImageLabel = "Share image",
  copyImageLabel = "Copy image",
  downloadLabel = "Download",
  onCopySuccess,
}: ShareSettlementActionsProps) {
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
      await downloadCardAsImage(cardRef.current, "splanno-settle-card.png");
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
        const file = new File([blob], "splanno-settle-card.png", { type: "image/png" });
        await navigator.share({
          title: `${data.eventName} — Settled`,
          text: data.settlements[0]
            ? `${data.settlements[0].from} owes ${data.settlements[0].to} — settled with Splanno`
            : "Settled with Splanno",
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
      {/* Hidden card for export - positioned off-screen */}
      <div
        ref={cardRef}
        className="absolute -left-[9999px] -top-[9999px] w-[400px]"
        aria-hidden
      >
        <SettleCard data={data} theme={theme} exportMode />
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
