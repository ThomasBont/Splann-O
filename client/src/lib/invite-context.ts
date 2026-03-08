import { inferPlanSubcategoryFromEventType } from "@shared/lib/plan-types";

export interface InvitePreview {
  bbqId: number;
  name: string;
  eventType: string;
  currency: string;
  inviterName?: string | null;
}

export interface InviteAuthContext extends InvitePreview {
  invitePath: string;
  token: string;
  typeLabel: string;
}

function formatLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function parseInvitePath(pathname: string | null | undefined): { token: string; invitePath: string } | null {
  const path = String(pathname ?? "").trim();
  if (!path.startsWith("/")) return null;
  const match = path.match(/^\/(join|invite)\/([^/?#]+)/i);
  if (!match) return null;
  return {
    token: decodeURIComponent(match[2]),
    invitePath: `/${match[1]}/${match[2]}`,
  };
}

export function getInviteTypeLabel(eventType: string | null | undefined): string {
  const value = String(eventType ?? "").trim().toLowerCase();
  const subcategory = inferPlanSubcategoryFromEventType(value);
  if (subcategory) return formatLabel(subcategory);
  if (value) return formatLabel(value);
  return "Plan";
}

export async function fetchInvitePreviewByPath(pathname: string | null | undefined): Promise<InviteAuthContext | null> {
  const parsed = parseInvitePath(pathname);
  if (!parsed) return null;

  const inviteRes = await fetch(`/api/invites/${parsed.token}`, { credentials: "include" });
  if (inviteRes.ok) {
    const body = await inviteRes.json() as {
      eventId?: number;
      id?: number;
      name: string;
      eventType: string;
      currency: string;
      inviterName?: string | null;
    };
    return {
      bbqId: Number(body.eventId ?? body.id),
      name: body.name,
      eventType: body.eventType,
      currency: body.currency,
      inviterName: body.inviterName ?? null,
      invitePath: parsed.invitePath,
      token: parsed.token,
      typeLabel: getInviteTypeLabel(body.eventType),
    };
  }

  const fallback = await fetch(`/api/join/${parsed.token}`, { credentials: "include" });
  if (!fallback.ok) return null;
  const body = await fallback.json() as {
    id: number;
    name: string;
    eventType: string;
    currency: string;
    inviterName?: string | null;
  };
  return {
    bbqId: Number(body.id),
    name: body.name,
    eventType: body.eventType,
    currency: body.currency,
    inviterName: body.inviterName ?? null,
    invitePath: parsed.invitePath,
    token: parsed.token,
    typeLabel: getInviteTypeLabel(body.eventType),
  };
}
