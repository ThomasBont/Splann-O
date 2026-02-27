/**
 * ICS is API-free universal calendar integration.
 * Generates RFC5545-compatible .ics content for Apple/Google/Outlook import.
 */

export type BuildIcsInput = {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  timezone?: string | null;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatUtcDateTime(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    `${pad2(date.getUTCMonth() + 1)}` +
    `${pad2(date.getUTCDate())}` +
    `T${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`
  );
}

function formatDateValue(date: Date): string {
  return `${date.getUTCFullYear()}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildIcs(input: BuildIcsInput): string {
  const now = new Date();
  const descriptionParts: string[] = [];
  if (input.description?.trim()) descriptionParts.push(input.description.trim());
  if (input.url?.trim()) descriptionParts.push(input.url.trim());
  const description = descriptionParts.join("\n\n");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Splanno//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(input.uid)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
  ];

  if (input.allDay) {
    const start = new Date(Date.UTC(input.start.getUTCFullYear(), input.start.getUTCMonth(), input.start.getUTCDate()));
    const endExclusive = new Date(Date.UTC(input.end.getUTCFullYear(), input.end.getUTCMonth(), input.end.getUTCDate()));
    lines.push(`DTSTART;VALUE=DATE:${formatDateValue(start)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDateValue(endExclusive)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDateTime(input.start)}`);
    lines.push(`DTEND:${formatUtcDateTime(input.end)}`);
  }

  lines.push(`SUMMARY:${escapeIcsText(input.title)}`);
  if (description) lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  if (input.location?.trim()) lines.push(`LOCATION:${escapeIcsText(input.location.trim())}`);
  if (input.url?.trim()) lines.push(`URL:${escapeIcsText(input.url.trim())}`);
  if (input.timezone?.trim()) lines.push(`X-WR-TIMEZONE:${escapeIcsText(input.timezone.trim())}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadIcs(filename: string, icsString: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function inferEventDateRange(dateValue: string | Date): { start: Date; end: Date; allDay: boolean } | null {
  const raw = typeof dateValue === "string" ? dateValue : dateValue.toISOString();
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;

  const looksDateOnly = typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
  const midnightUtc =
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    start.getUTCSeconds() === 0 &&
    start.getUTCMilliseconds() === 0;
  const allDay = looksDateOnly || midnightUtc;

  if (allDay) {
    const dayStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const nextDay = new Date(dayStart);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    return { start: dayStart, end: nextDay, allDay: true };
  }

  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start, end, allDay: false };
}

