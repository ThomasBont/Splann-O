import type { EventTemplate, EventTemplateKey } from "./types";
import { isTripEventType, getTripTemplate } from "./tripTemplates";
import { isPartyEventType, getPartyTemplate } from "./partyTemplates";

const DEFAULT_TEMPLATE: EventTemplate = {
  key: "default",
  theme: { wrapperClass: "rounded-2xl" },
  heroStyle: "none",
};

/** Map DB event_type string to EventTemplateKey for template lookup. */
export function eventTypeToTemplateKey(eventType: string | null | undefined): EventTemplateKey {
  if (!eventType) return "default";
  if (isPartyEventType(eventType)) return "party";
  if (isTripEventType(eventType)) return "trip";
  return "default";
}

/** Get template for an event type. Uses party or trip template registry when applicable. */
export function getEventTemplate(eventType: string | null | undefined): EventTemplate {
  if (isTripEventType(eventType)) {
    const trip = getTripTemplate(eventType);
    return {
      key: "trip",
      theme: {
        tokens: trip.themeTokens,
        wrapperClass: "rounded-2xl",
      },
      heroStyle: "minimal",
    };
  }
  if (isPartyEventType(eventType)) {
    const party = getPartyTemplate(eventType);
    return {
      key: "party",
      theme: {
        tokens: party.tokens,
        wrapperClass: "rounded-2xl",
      },
      heroStyle: "minimal",
    };
  }
  return DEFAULT_TEMPLATE;
}

/** @deprecated Use getEventTemplate. Kept for backwards compatibility. */
export const templates: Record<EventTemplateKey, EventTemplate> = {
  default: DEFAULT_TEMPLATE,
  barbecue: DEFAULT_TEMPLATE,
  birthday: DEFAULT_TEMPLATE,
  trip: DEFAULT_TEMPLATE,
  party: DEFAULT_TEMPLATE,
};
