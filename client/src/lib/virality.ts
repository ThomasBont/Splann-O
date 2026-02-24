/**
 * Centralized virality / share payload logic.
 * Future-proof for badges, stats, referrals, etc.
 */

import type { SettleCardData, RecapCardData } from "@/utils/shareCard";

export type SharePayloadType = "settle" | "recap" | "profileBadge";

export interface SharePayload {
  type: SharePayloadType;
  title?: string;
  text?: string;
  url?: string;
  /** For image-based shares (settle, recap cards) */
  cardData?: SettleCardData | RecapCardData;
}

/**
 * Generate a share payload for a given type and data.
 * Keeps virality logic centralized and extensible.
 */
export function generateSharePayload(
  type: SharePayloadType,
  data: Record<string, unknown>
): SharePayload {
  switch (type) {
    case "settle": {
      const d = data as unknown as SettleCardData;
      return {
        type: "settle",
        title: `${d.eventName} — Settled`,
        text: d.settlements[0]
          ? `${d.settlements[0].from} owes ${d.settlements[0].to} — settled with Splanno`
          : "Settled with Splanno",
        cardData: d,
      };
    }
    case "recap": {
      const d = data as unknown as RecapCardData;
      const sym = d.currency === "USD" ? "$" : d.currency === "GBP" ? "£" : "€";
      return {
        type: "recap",
        title: `${d.eventName} — Recap`,
        text: `${d.eventName}: ${sym}${d.totalSpent.toFixed(2)} split among ${d.participantCount} people — Split smart with Splanno`,
        cardData: d,
      };
    }
    case "profileBadge":
      return {
        type: "profileBadge",
        title: "Splanno",
        text: "Split costs, stay friends",
        ...data,
      };
    default:
      return { type, ...data };
  }
}
