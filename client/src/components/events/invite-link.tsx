"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, QrCode, Loader2, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { buildShareMessage, openWhatsAppOrCopy } from "@/lib/share-message";
import { copyText } from "@/lib/copy-text";

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
  whatsappLabel?: string;
  whatsappFallbackCopied?: string;
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
  whatsappLabel = "WhatsApp",
  whatsappFallbackCopied = "Message copied. Paste it into WhatsApp.",
  className,
}: InviteLinkProps) {
  const [displayUrl, setDisplayUrl] = useState(url);
  const [ensuring, setEnsuring] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
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
          const ok = await copyText(newUrl);
          if (ok) toast({ title: copySuccess });
          else {
            inputRef.current?.focus();
            inputRef.current?.select();
            toast({ title: "Copy failed — select and copy manually." });
          }
        }
      }
      return;
    }
    const ok = await copyText(toCopy);
    if (ok) toast({ title: copySuccess });
    else {
      inputRef.current?.focus();
      inputRef.current?.select();
      toast({ title: "Copy failed — select and copy manually." });
    }
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

  const handleShareWhatsApp = async () => {
    const toShare = displayUrl || url;
    if (!toShare) {
      const newUrl = await handleEnsureToken();
      if (!newUrl) return;
      const message = buildShareMessage({ title: "Join my event on Splanno", url: newUrl });
      const result = await openWhatsAppOrCopy(message);
      toast({ title: result === "copied" ? whatsappFallbackCopied : "Opening WhatsApp…" });
      return;
    }
    const message = buildShareMessage({ title: "Join my event on Splanno", url: toShare });
    const result = await openWhatsAppOrCopy(message);
    toast({ title: result === "copied" ? whatsappFallbackCopied : "Opening WhatsApp…" });
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
          const ok = await copyText(shareUrl);
          if (ok) toast({ title: copySuccess });
          else {
            inputRef.current?.focus();
            inputRef.current?.select();
            toast({ title: "Copy failed — select and copy manually." });
          }
        }
      }
    } else {
      const ok = await copyText(shareUrl);
      if (ok) toast({ title: copySuccess });
      else {
        inputRef.current?.focus();
        inputRef.current?.select();
        toast({ title: "Copy failed — select and copy manually." });
      }
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
          ref={inputRef}
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
        <Button
          variant="outline"
          size="icon"
          onClick={handleShareWhatsApp}
          disabled={ensuring}
          title={whatsappLabel}
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
          disabled={ensuring}
          title="Select link"
        >
          <span className="text-xs font-semibold">Aa</span>
        </Button>
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
