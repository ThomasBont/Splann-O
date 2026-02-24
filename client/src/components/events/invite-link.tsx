"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, QrCode, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface InviteLinkProps {
  /** Full join URL (e.g. https://app.example.com/join/abc123). */
  url: string;
  /** Called when ensuring token (e.g. backfill). Returns updated URL if token was created. */
  onEnsureToken?: () => Promise<string | null>;
  /** i18n labels */
  label?: string;
  copyLabel?: string;
  copySuccess?: string;
  shareLabel?: string;
  className?: string;
}

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

/** Invite link with copy and optional native share. Clean, premium input. */
export function InviteLink({
  url,
  onEnsureToken,
  label = "Invite link",
  copyLabel = "Copy",
  copySuccess = "Copied!",
  shareLabel = "Share",
  className,
}: InviteLinkProps) {
  const [displayUrl, setDisplayUrl] = useState(url);
  const [ensuring, setEnsuring] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setDisplayUrl(url);
  }, [url]);

  const handleEnsureToken = async () => {
    if (!onEnsureToken) return displayUrl;
    setEnsuring(true);
    try {
      const newUrl = await onEnsureToken();
      if (newUrl) {
        setDisplayUrl(newUrl);
        return newUrl;
      }
    } finally {
      setEnsuring(false);
    }
    return displayUrl;
  };

  const handleCopy = async () => {
    const toCopy = displayUrl || url;
    if (!toCopy) {
      if (onEnsureToken) {
        const newUrl = await handleEnsureToken();
        if (newUrl) {
          await navigator.clipboard.writeText(newUrl);
          toast({ title: copySuccess });
        }
      }
      return;
    }
    await navigator.clipboard.writeText(toCopy);
    toast({ title: copySuccess });
  };

  const handleShare = async () => {
    const toShare = displayUrl || url;
    if (!toShare) {
      const newUrl = await handleEnsureToken();
      if (!newUrl) return;
      await shareUrl(newUrl);
      return;
    }
    await shareUrl(toShare);
  };

  async function shareUrl(shareUrl: string) {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Join my event on Splanno",
          url: shareUrl,
          text: "Join my event on Splanno",
        });
        toast({ title: "Shared!" });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await navigator.clipboard.writeText(shareUrl);
          toast({ title: copySuccess });
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: copySuccess });
    }
  }

  if (!ENABLE_SHARING) return null;

  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground block mb-1.5">
        {label}
      </label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={displayUrl}
          className="flex-1 font-mono text-sm bg-muted/30 border-border"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          disabled={ensuring}
          title={copyLabel}
        >
          {ensuring ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button
            variant="outline"
            size="icon"
            onClick={handleShare}
            disabled={ensuring}
            title={shareLabel}
          >
            <Share2 className="w-4 h-4" />
          </Button>
        )}
        {/* Future QR placeholder - small icon for visual hint */}
        <div
          className="flex items-center justify-center w-10 h-10 rounded-md border border-border bg-muted/20 text-muted-foreground/50 cursor-not-allowed"
          title="QR code (coming soon)"
        >
          <QrCode className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}
