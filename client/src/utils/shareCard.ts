/**
 * Helper for shareable card data.
 * Future-proof for multiple settlements, event recap cards, etc.
 */

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export interface EventInfo {
  name: string;
  subtitle?: string;
  eventType?: string;
  area?: string;
  currency?: string;
}

export interface SettleCardData {
  eventName: string;
  subtitle: string;
  settlements: Settlement[];
  currency: string;
}

export interface RecapCardData {
  eventName: string;
  totalSpent: number;
  participantCount: number;
  expenseCount: number;
  funStat?: {
    type: "biggest_spender" | "most_generous" | "total_expenses";
    label: string;
    value: string;
  };
  currency: string;
}

/** Generate data for a single-settlement settle card. */
export function generateSettleCardData(
  event: EventInfo,
  settlement: Settlement,
  subtitle?: string
): SettleCardData {
  return {
    eventName: event.name,
    subtitle: subtitle ?? event.subtitle ?? "",
    settlements: [settlement],
    currency: event.currency ?? "EUR",
  };
}

/** Generate data for a multi-settlement settle card (future use). */
export function generateMultiSettleCardData(
  event: EventInfo,
  settlements: Settlement[],
  subtitle?: string
): SettleCardData {
  return {
    eventName: event.name,
    subtitle: subtitle ?? event.subtitle ?? "",
    settlements,
    currency: event.currency ?? "EUR",
  };
}

/** Generate data for event recap card. */
export function generateRecapCardData(
  event: EventInfo,
  opts: {
    totalSpent: number;
    participantCount: number;
    expenseCount: number;
    funStat?: { type: "biggest_spender" | "most_generous" | "total_expenses"; label: string; value: string };
  }
): RecapCardData {
  return {
    eventName: event.name,
    totalSpent: opts.totalSpent,
    participantCount: opts.participantCount,
    expenseCount: opts.expenseCount,
    funStat: opts.funStat,
    currency: event.currency ?? "EUR",
  };
}
