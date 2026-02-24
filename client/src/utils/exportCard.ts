/**
 * Export share cards as images.
 * Uses html-to-image for PNG export and clipboard.
 */

import { toPng } from "html-to-image";

const DEFAULT_OPTIONS: Parameters<typeof toPng>[1] = {
  cacheBust: true,
  pixelRatio: 2,
  quality: 1,
  skipFonts: true,
  backgroundColor: "#1a1a1e",
};

/**
 * Export a card DOM element to PNG and return the data URL.
 */
export async function exportCardAsImage(
  element: HTMLElement,
  options?: Parameters<typeof toPng>[1]
): Promise<string> {
  return toPng(element, {
    ...DEFAULT_OPTIONS,
    ...options,
  });
}

/**
 * Export card to PNG and trigger download.
 */
export async function downloadCardAsImage(
  element: HTMLElement,
  filename = "splanno-settle-card.png",
  options?: Parameters<typeof toPng>[1]
): Promise<void> {
  const dataUrl = await exportCardAsImage(element, options);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

/**
 * Copy card image to clipboard (if Clipboard API supports images).
 */
export async function copyImageToClipboard(element: HTMLElement): Promise<boolean> {
  try {
    const dataUrl = await exportCardAsImage(element);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    if (!navigator.clipboard?.write) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch {
    return false;
  }
}
