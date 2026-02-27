import { copyText } from "@/lib/copy-text";

type ShareMessageInput = {
  title: string;
  url: string;
  emoji?: string | null;
  location?: string | null;
  date?: string | null;
};

type WhatsAppEventInput = {
  title: string;
  url: string;
  emoji?: string | null;
  date?: string | Date | null;
  location?: string | null;
};

export function buildShareMessage(input: ShareMessageInput): string {
  const parts: string[] = [];
  const emoji = input.emoji?.trim();
  const headline = `${emoji ? `${emoji} ` : ""}${input.title}`.trim();
  if (headline) parts.push(headline);
  if (input.location) parts.push(input.location);
  if (input.date) parts.push(input.date);
  parts.push(input.url);
  return parts.join("\n");
}

export function buildWhatsAppMessage(event: WhatsAppEventInput): string {
  const dateText = event.date
    ? (event.date instanceof Date ? event.date.toLocaleString() : new Date(event.date).toLocaleString())
    : null;
  return buildShareMessage({
    title: event.title,
    emoji: event.emoji,
    url: event.url,
    location: event.location ?? null,
    date: dateText,
  });
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export async function openWhatsAppOrCopy(message: string): Promise<"opened" | "copied"> {
  const shareUrl = buildWhatsAppShareUrl(message);
  try {
    if (typeof window !== "undefined") {
      const popup = window.open(shareUrl, "_blank", "noopener,noreferrer");
      if (popup) return "opened";
    }
  } catch {
    // fallback to clipboard
  }
  const copied = await copyText(message);
  if (copied) {
    return "copied";
  }
  return "opened";
}
