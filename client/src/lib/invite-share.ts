const PRODUCTION_INVITE_BASE_URL = "https://splanno.app";
const DEVELOPMENT_INVITE_BASE_URL = "http://localhost:5001";

type InviteEventContext = {
  name?: string | null;
  location?: string | null;
  locationName?: string | null;
  locationText?: string | null;
  city?: string | null;
  countryName?: string | null;
  type?: string | null;
  eventType?: string | null;
  date?: string | Date | null;
};

function resolveInviteBaseUrl(forceProduction: boolean = true) {
  if (forceProduction) return PRODUCTION_INVITE_BASE_URL;
  return import.meta.env.PROD ? PRODUCTION_INVITE_BASE_URL : DEVELOPMENT_INVITE_BASE_URL;
}

function normalizeEventType(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveInviteLocation(event: InviteEventContext) {
  return event.location
    ?? event.locationName
    ?? event.locationText
    ?? [event.city, event.countryName].filter(Boolean).join(", ")
    ?? "";
}

function formatInviteDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const dayMonth = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dayMonth} · ${time}`;
}

function getInviteIntro(event: InviteEventContext) {
  const eventType = normalizeEventType(event.type ?? event.eventType ?? null);
  if (
    eventType.includes("trip")
    || eventType.includes("vacation")
    || eventType.includes("road")
    || eventType.includes("ski")
    || eventType.includes("festival")
    || eventType.includes("backpacking")
  ) {
    return "Join our trip on Splanno ✈️";
  }
  if (eventType.includes("birthday")) {
    return "You're invited to a birthday plan 🎂";
  }
  if (eventType.includes("dinner") || eventType.includes("brunch")) {
    return "Join our dinner plan 🍝";
  }
  return "You're invited to a plan on Splanno 🎉";
}

export function buildInviteUrl(inviteToken?: string | null, options?: { forceProduction?: boolean }) {
  if (!inviteToken) return "";
  return `${resolveInviteBaseUrl(options?.forceProduction ?? true)}/join/${inviteToken}`;
}

export function generateInviteMessage(event: InviteEventContext, inviteUrl: string) {
  const lines = [
    getInviteIntro(event),
    "",
    String(event.name ?? "").trim() || "Splanno plan",
  ];

  const location = resolveInviteLocation(event).trim();
  const date = formatInviteDate(event.date);
  if (location) lines.push(`📍 ${location}`);
  if (date) lines.push(`📅 ${date}`);

  lines.push("");
  lines.push("Join the plan:");
  lines.push(inviteUrl);
  lines.push("");
  lines.push("Split costs, stay friends.");

  return lines.join("\n").trim();
}
