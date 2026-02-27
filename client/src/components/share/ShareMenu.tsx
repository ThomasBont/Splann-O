"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "@/lib/copy-text";
import {
  canSafelyCopyPngToClipboard,
  canNativeShareFile,
  nodeToPngBlob,
  copyPngBlobToClipboard,
  downloadBlob,
  shareTextViaWhatsApp,
  nativeShareFile,
} from "@/lib/shareImage";
import { Share2, MessageCircle, Share, Download, Copy, Link2 } from "lucide-react";

const ENABLE_SHARING = import.meta.env.VITE_ENABLE_SHARING !== "false";

export interface ShareMenuProps {
  /** Ref to DOM node to capture for PNG (e.g. hidden recap/settle card). */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Label for scope in menu items: "Summary" or "Settlement". */
  scopeLabel: string;
  /** Text to share via WhatsApp and native share. */
  shareText: string;
  /** Filename for PNG download. */
  filename: string;
  /** Optional share link to copy (invite URL). */
  shareLink?: string | null;
  /** Primary trigger: full button with label. */
  variant?: "primary" | "icon";
  /** i18n labels. */
  labels: {
    share: string;
    shareWhatsApp: string;
    shareMore: string;
    downloadPng: string;
    copyImage: string;
    copyImageUnsupported: string;
    copyShareLink: string;
    copied: string;
    downloaded: string;
    shared: string;
    error: string;
  };
  className?: string;
  children?: React.ReactNode;
}

/** Single Share dropdown: WhatsApp, native share, download, copy image, copy link. */
export function ShareMenu({
  targetRef,
  scopeLabel,
  shareText,
  filename,
  shareLink,
  variant = "primary",
  labels,
  className,
  children,
}: ShareMenuProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canCopy = canSafelyCopyPngToClipboard();
  const canNativeShare = canNativeShareFile();

  const handleWhatsApp = () => {
    shareTextViaWhatsApp(shareText);
    toast({ title: labels.shared, variant: "success" });
    setOpen(false);
  };

  const handleNativeShare = async () => {
    if (!targetRef.current) {
      toast({ title: labels.error, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const blob = await nodeToPngBlob(targetRef.current);
      const file = new File([blob], filename, { type: "image/png" });
      const ok = await nativeShareFile(file, scopeLabel, shareText);
      if (ok) {
        toast({ title: labels.shared, variant: "success" });
        setOpen(false);
      } else {
        toast({ title: labels.error, variant: "destructive" });
      }
    } catch {
      toast({ title: labels.error, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    if (!targetRef.current) {
      toast({ title: labels.error, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const blob = await nodeToPngBlob(targetRef.current);
      downloadBlob(blob, filename);
      toast({ title: labels.downloaded, variant: "success" });
      setOpen(false);
    } catch {
      toast({ title: labels.error, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyImage = async () => {
    if (!targetRef.current) {
      toast({ title: labels.error, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const blob = await nodeToPngBlob(targetRef.current);
      await copyPngBlobToClipboard(blob);
      toast({ title: labels.copied, variant: "success" });
      setOpen(false);
    } catch {
      toast({ title: labels.copyImageUnsupported, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    const ok = await copyText(shareLink);
    if (ok) {
      toast({ title: labels.copied, variant: "success" });
      setOpen(false);
    } else {
      toast({ title: labels.error, variant: "destructive" });
    }
  };

  if (!ENABLE_SHARING) return null;

  const trigger =
    children ?? (
      variant === "primary" ? (
        <Button variant="default" size="sm" className="gap-1.5">
          <Share2 className="w-4 h-4" />
          {labels.share}
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-70 hover:opacity-100">
          <Share2 className="w-4 h-4" />
        </Button>
      )
    );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild disabled={busy}>
          {trigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Share
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleWhatsApp}>
            <MessageCircle className="w-4 h-4 mr-2" />
            {labels.shareWhatsApp}
          </DropdownMenuItem>
          {canNativeShare && (
            <DropdownMenuItem onClick={handleNativeShare} disabled={busy}>
              <Share className="w-4 h-4 mr-2" />
              {labels.shareMore}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Export
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={handleDownload} disabled={busy}>
            <Download className="w-4 h-4 mr-2" />
            {labels.downloadPng}
          </DropdownMenuItem>
          {canCopy ? (
            <DropdownMenuItem onClick={handleCopyImage} disabled={busy}>
              <Copy className="w-4 h-4 mr-2" />
              {labels.copyImage}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled
              title={labels.copyImageUnsupported}
              onSelect={(e) => e.preventDefault()}
            >
              <Copy className="w-4 h-4 mr-2" />
              {labels.copyImage}
            </DropdownMenuItem>
          )}
          {shareLink && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCopyLink}>
                <Link2 className="w-4 h-4 mr-2" />
                {labels.copyShareLink}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
