/**
 * Share image utilities.
 * Uses html-to-image for PNG export. Handles Firefox blank-image issues.
 */

import { toPng } from "html-to-image";
import type { Settlement, RecapCardData } from "@/utils/shareCard";

const DEFAULT_BG = "#1a1a1e";

const PNG_OPTIONS: Parameters<typeof toPng>[1] = {
  cacheBust: true,
  pixelRatio: 2,
  backgroundColor: DEFAULT_BG,
  quality: 1,
  skipFonts: true,
};

/** ClipboardItem + navigator.clipboard.write exist; Firefox often fails image copy. */
export function canCopyPngToClipboard(): boolean {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) return false;
  try {
    return typeof ClipboardItem !== "undefined";
  } catch {
    return false;
  }
}

/** Detect Firefox - avoid clipboard image copy (produces blank). */
function isFirefox(): boolean {
  return /Firefox/i.test(navigator?.userAgent ?? "");
}

export function canSafelyCopyPngToClipboard(): boolean {
  return canCopyPngToClipboard() && !isFirefox();
}

export interface NodeToPngOptions {
  backgroundColor?: string;
  pixelRatio?: number;
}

/**
 * Convert DOM node to PNG Blob.
 * Uses backgroundColor, pixelRatio 2, cacheBust, useCORS.
 * Safety check: fetches data URL to Blob and ensures blob.size > 0.
 */
export async function nodeToPngBlob(
  node: HTMLElement,
  opts?: NodeToPngOptions
): Promise<Blob> {
  const dataUrl = await toPng(node, {
    ...PNG_OPTIONS,
    backgroundColor: opts?.backgroundColor ?? DEFAULT_BG,
    pixelRatio: opts?.pixelRatio ?? 2,
  });

  const res = await fetch(dataUrl);
  const blob = await res.blob();

  if (blob.size === 0) {
    throw new Error("Image export produced empty file. Use Download instead.");
  }

  return blob;
}

export async function copyPngBlobToClipboard(blob: Blob): Promise<void> {
  if (!canSafelyCopyPngToClipboard()) {
    throw new Error("Not supported in this browser. Use Download instead.");
  }
  await navigator.clipboard!.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function shareTextViaWhatsApp(text: string): void {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank", "noopener,noreferrer");
}

/** Check if native Web Share API can share files. */
export function canNativeShareFile(): boolean {
  return typeof navigator !== "undefined" && !!navigator.canShare && !!navigator.share;
}

export async function nativeShareFile(
  file: File,
  title?: string,
  text?: string
): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.share) {
    return false;
  }
  try {
    const payload: ShareData = { files: [file] };
    if (title) payload.title = title;
    if (text) payload.text = text;
    if (!navigator.canShare(payload)) return false;
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}

export function buildSettlementShareText(
  s: Settlement,
  eventName?: string
): string {
  const line = `${s.from} owes ${s.to} ${s.amount.toFixed(2)}`;
  return eventName ? `${eventName}: ${line} — settled with Splanno` : line;
}

export function buildSummaryShareText(data: RecapCardData): string {
  const total = data.totalSpent.toFixed(2);
  const part = data.participantCount;
  const line = `${data.eventName}: ${total} split among ${part} people`;
  return `${line} — Split smart with Splanno`;
}
